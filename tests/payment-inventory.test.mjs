import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Phase 1B: Payment & Inventory State Machine Test Suite
 *
 * Scenarios tested:
 * 1. Successful payment: stock is NOT restored; order becomes paid/confirmed.
 * 2. Failed payment: stock and coupon are released once.
 * 3. Cancelled payment: stock and coupon are released once.
 * 4. 30-minute expired pending order: stock and coupon are released.
 * 5. Duplicate IPN: idempotent, zero duplicate stock/coupon/audit updates.
 * 6. IPN and browser redirect concurrent race condition: handled safely without double restore.
 * 7. Low-stock concurrent checkout: atomic updateMany prevents oversell.
 */

// Mock Database Environment for deterministic state machine testing
class MockDatabase {
  constructor() {
    this.reset()
  }

  reset() {
    this.products = new Map([
      ['prod-1', { id: 'prod-1', name: 'Mustard Oil 1L', stock: 10 }],
      ['prod-2', { id: 'prod-2', name: 'Sundarban Honey 500g', stock: 2 }], // low stock
    ])
    this.coupons = new Map([
      ['OFF100', { code: 'OFF100', usedCount: 1, usageLimit: 10, isActive: true }],
    ])
    this.orders = new Map()
    this.orderItems = new Map()
    this.statusHistory = []
    this.auditLogs = []
    this.payments = new Map()
  }

  createOrder(orderData, items) {
    const order = {
      id: orderData.id,
      orderNumber: orderData.orderNumber,
      totalAmount: orderData.totalAmount,
      paymentMethod: orderData.paymentMethod || 'online',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      couponCode: orderData.couponCode || null,
      stockReserved: true,
      couponReleased: false,
      reservationExpiresAt: orderData.reservationExpiresAt || new Date(Date.now() + 30 * 60 * 1000),
      createdAt: orderData.createdAt || new Date(),
    }
    this.orders.set(order.id, order)
    this.orderItems.set(order.id, items)
    return order
  }

  async atomicCheckout(orderData, items) {
    // Simulates tx.product.updateMany({ where: { id, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } })
    for (const item of items) {
      const prod = this.products.get(item.productId)
      if (!prod || prod.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.productName || item.productId}`)
      }
    }
    for (const item of items) {
      const prod = this.products.get(item.productId)
      prod.stock -= item.quantity
    }
    if (orderData.couponCode) {
      const coupon = this.coupons.get(orderData.couponCode)
      if (coupon) coupon.usedCount++
    }
    return this.createOrder(orderData, items)
  }

  async releaseOrderInventoryAndCoupon(orderId, reason) {
    const order = this.orders.get(orderId)
    if (!order) return { success: false, reason: 'Order not found' }

    // Idempotency: only release if stock is currently reserved and order is not paid
    if (!order.stockReserved || order.paymentStatus === 'paid') {
      return { success: true, alreadyReleased: true, restoredStock: 0, restoredCoupon: false }
    }

    const items = this.orderItems.get(orderId) || []
    let totalStockRestored = 0

    // 1. Restore product stock atomically
    for (const item of items) {
      const prod = this.products.get(item.productId)
      if (prod) {
        prod.stock += item.quantity
        totalStockRestored += item.quantity
      }
    }

    // 2. Release coupon reservation if applicable
    let couponRestored = false
    if (order.couponCode && !order.couponReleased) {
      const coupon = this.coupons.get(order.couponCode)
      if (coupon && coupon.usedCount > 0) {
        coupon.usedCount--
        couponRestored = true
      }
      order.couponReleased = true
    }

    // 3. Mark stock released and update order status
    order.stockReserved = false
    order.orderStatus = 'cancelled'
    order.paymentStatus = reason.paymentStatus || 'failed'

    // 4. Record history & audit
    this.statusHistory.push({
      orderId,
      status: 'cancelled',
      note: reason.note,
      at: new Date(),
    })
    this.auditLogs.push({
      module: 'orders',
      action: 'inventory_release',
      orderId,
      restoredStock: totalStockRestored,
    })

    return {
      success: true,
      alreadyReleased: false,
      restoredStock: totalStockRestored,
      restoredCoupon: couponRestored,
    }
  }

  async finalizeOrderPayment(orderId, paymentData) {
    const order = this.orders.get(orderId)
    if (!order) return { success: false, reason: 'Order not found' }

    if (!order.stockReserved || order.orderStatus === 'cancelled') {
      return { success: false, reason: 'Order already cancelled / stock released' }
    }

    if (order.paymentStatus === 'paid') {
      return { success: true, alreadyPaid: true }
    }

    order.paymentStatus = 'paid'
    order.orderStatus = 'confirmed'
    order.reservationExpiresAt = null // Permanently confirmed

    this.payments.set(orderId, {
      orderId,
      status: 'paid',
      transactionId: paymentData?.transactionId || 'TXN-123',
      at: new Date(),
    })

    this.statusHistory.push({
      orderId,
      status: 'confirmed',
      note: 'Payment successful via IPN validation',
      at: new Date(),
    })

    return { success: true, alreadyPaid: false }
  }

  async expirePendingOrders(now = new Date()) {
    const expired = []
    for (const order of this.orders.values()) {
      if (
        order.paymentMethod === 'online' &&
        order.paymentStatus === 'pending' &&
        order.stockReserved === true &&
        order.reservationExpiresAt &&
        order.reservationExpiresAt <= now
      ) {
        expired.push(order.id)
      }
    }

    let processed = 0
    for (const orderId of expired) {
      const res = await this.releaseOrderInventoryAndCoupon(orderId, {
        paymentStatus: 'expired',
        note: 'Order reservation expired after 30 minutes',
      })
      if (res.success && !res.alreadyReleased) {
        processed++
      }
    }
    return { count: processed, orderIds: expired }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite Execution
// ─────────────────────────────────────────────────────────────────────────────

test('1. Successful payment: stock is NOT restored and order transitions to paid/confirmed', async () => {
  const db = new MockDatabase()
  await db.atomicCheckout(
    { id: 'ord-1', orderNumber: 'KK-1001', totalAmount: 1200 },
    [{ productId: 'prod-1', quantity: 2 }]
  )
  assert.equal(db.products.get('prod-1').stock, 8, 'Stock was decremented to 8 upon checkout')

  const result = await db.finalizeOrderPayment('ord-1', { transactionId: 'TXN-SUCCESS' })
  assert.equal(result.success, true)
  assert.equal(result.alreadyPaid, false)

  const order = db.orders.get('ord-1')
  assert.equal(order.paymentStatus, 'paid')
  assert.equal(order.orderStatus, 'confirmed')
  assert.equal(order.stockReserved, true, 'Stock remains committed/reserved')
  assert.equal(order.reservationExpiresAt, null, 'Reservation expiry cleared')
  assert.equal(db.products.get('prod-1').stock, 8, 'Stock must NOT be restored on successful payment')
})

test('2. Failed payment: stock and coupon are released atomically in one transaction', async () => {
  const db = new MockDatabase()
  await db.atomicCheckout(
    { id: 'ord-2', orderNumber: 'KK-1002', totalAmount: 1500, couponCode: 'OFF100' },
    [{ productId: 'prod-1', quantity: 3 }]
  )
  assert.equal(db.products.get('prod-1').stock, 7)
  assert.equal(db.coupons.get('OFF100').usedCount, 2, 'Coupon usage incremented on checkout')

  const releaseResult = await db.releaseOrderInventoryAndCoupon('ord-2', {
    paymentStatus: 'failed',
    note: 'SSLCOMMERZ transaction failed',
  })
  assert.equal(releaseResult.success, true)
  assert.equal(releaseResult.alreadyReleased, false)
  assert.equal(releaseResult.restoredStock, 3)
  assert.equal(releaseResult.restoredCoupon, true)

  assert.equal(db.products.get('prod-1').stock, 10, 'Stock restored back to 10')
  assert.equal(db.coupons.get('OFF100').usedCount, 1, 'Coupon usage decremented back')
  assert.equal(db.orders.get('ord-2').orderStatus, 'cancelled')
  assert.equal(db.orders.get('ord-2').stockReserved, false)
})

test('3. Cancelled payment: stock and coupon are released', async () => {
  const db = new MockDatabase()
  await db.atomicCheckout(
    { id: 'ord-3', orderNumber: 'KK-1003', totalAmount: 500, couponCode: 'OFF100' },
    [{ productId: 'prod-1', quantity: 1 }]
  )
  assert.equal(db.products.get('prod-1').stock, 9)

  const releaseResult = await db.releaseOrderInventoryAndCoupon('ord-3', {
    paymentStatus: 'cancelled',
    note: 'Customer cancelled at payment gateway',
  })
  assert.equal(releaseResult.success, true)
  assert.equal(releaseResult.restoredStock, 1)

  assert.equal(db.products.get('prod-1').stock, 10, 'Stock restored to 10')
  assert.equal(db.orders.get('ord-3').paymentStatus, 'cancelled')
  assert.equal(db.orders.get('ord-3').orderStatus, 'cancelled')
})

test('4. 30-minute expired pending order: cleanup cron releases stock and coupon', async () => {
  const db = new MockDatabase()
  const pastTime = new Date(Date.now() - 35 * 60 * 1000) // 35 minutes ago
  db.products.get('prod-1').stock = 10

  await db.atomicCheckout(
    { id: 'ord-expired', orderNumber: 'KK-1004', totalAmount: 800, reservationExpiresAt: new Date(Date.now() - 5000) },
    [{ productId: 'prod-1', quantity: 4 }]
  )
  assert.equal(db.products.get('prod-1').stock, 6, 'Stock decremented to 6 on order placement')

  const expiryRun = await db.expirePendingOrders(new Date())
  assert.equal(expiryRun.count, 1, 'One order detected as expired')

  assert.equal(db.products.get('prod-1').stock, 10, 'Stock restored back to 10 after expiry')
  assert.equal(db.orders.get('ord-expired').paymentStatus, 'expired')
  assert.equal(db.orders.get('ord-expired').orderStatus, 'cancelled')
})

test('5. Duplicate IPN: idempotent, zero duplicate stock/coupon/audit updates', async () => {
  const db = new MockDatabase()
  await db.atomicCheckout(
    { id: 'ord-5', orderNumber: 'KK-1005', totalAmount: 1000 },
    [{ productId: 'prod-1', quantity: 2 }]
  )

  // First IPN
  const ipn1 = await db.finalizeOrderPayment('ord-5', { transactionId: 'TXN-5' })
  assert.equal(ipn1.success, true)
  assert.equal(ipn1.alreadyPaid, false)

  // Duplicate IPN
  const ipn2 = await db.finalizeOrderPayment('ord-5', { transactionId: 'TXN-5' })
  assert.equal(ipn2.success, true)
  assert.equal(ipn2.alreadyPaid, true, 'Second IPN detects alreadyPaid and does not re-apply')

  assert.equal(db.statusHistory.length, 1, 'Status history created only once')
  assert.equal(db.products.get('prod-1').stock, 8, 'Stock remains unchanged')
})

test('6. IPN and browser redirect concurrent race condition: handled safely without double restore', async () => {
  const db = new MockDatabase()
  await db.atomicCheckout(
    { id: 'ord-6', orderNumber: 'KK-1006', totalAmount: 1000, couponCode: 'OFF100' },
    [{ productId: 'prod-1', quantity: 2 }]
  )
  assert.equal(db.products.get('prod-1').stock, 8)
  assert.equal(db.coupons.get('OFF100').usedCount, 2)

  // Simulate concurrent browser cancel and IPN cancel hitting server simultaneously
  const [resA, resB] = await Promise.all([
    db.releaseOrderInventoryAndCoupon('ord-6', { paymentStatus: 'cancelled', note: 'Browser cancel' }),
    db.releaseOrderInventoryAndCoupon('ord-6', { paymentStatus: 'cancelled', note: 'IPN cancel' }),
  ])

  const oneSucceeded = (resA.alreadyReleased === false && resB.alreadyReleased === true) ||
                       (resA.alreadyReleased === true && resB.alreadyReleased === false)
  assert.equal(oneSucceeded, true, 'Exactly one release operation restored stock, the other was idempotent')

  assert.equal(db.products.get('prod-1').stock, 10, 'Stock restored exactly once (10, not 12)')
  assert.equal(db.coupons.get('OFF100').usedCount, 1, 'Coupon released exactly once (1, not 0)')
})

test('7. Low-stock concurrent checkout: atomic updateMany prevents oversell', async () => {
  const db = new MockDatabase()
  // prod-2 has stock = 2
  assert.equal(db.products.get('prod-2').stock, 2)

  // Two customers attempt to buy 2 units at the exact same time
  const customer1 = db.atomicCheckout(
    { id: 'ord-c1', orderNumber: 'KK-C1', totalAmount: 1000 },
    [{ productId: 'prod-2', quantity: 2 }]
  )
  const customer2 = db.atomicCheckout(
    { id: 'ord-c2', orderNumber: 'KK-C2', totalAmount: 1000 },
    [{ productId: 'prod-2', quantity: 2 }]
  )

  const outcomes = await Promise.allSettled([customer1, customer2])
  const fulfilled = outcomes.filter((o) => o.status === 'fulfilled')
  const rejected = outcomes.filter((o) => o.status === 'rejected')

  assert.equal(fulfilled.length, 1, 'Only one customer succeeded')
  assert.equal(rejected.length, 1, 'The other customer received insufficient stock error')
  assert.equal(db.products.get('prod-2').stock, 0, 'Stock reached exactly 0 and NEVER went below 0')
})
