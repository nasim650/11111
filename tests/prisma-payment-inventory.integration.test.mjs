import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

// Import the generated Prisma Test Client connected to local test database
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()

// Import the real production service functions
const {
  releaseOrderInventoryAndCoupon,
  finalizeOrderPayment,
  expirePendingOrders,
} = await import('../src/lib/order-inventory.ts')

// Helper to seed standard test entities
async function setupTestEnvironment() {
  // Clean all test tables in reverse relational order
  await testDb.auditLog.deleteMany()
  await testDb.orderStatusHistory.deleteMany()
  await testDb.payment.deleteMany()
  await testDb.deliveryLabel.deleteMany()
  await testDb.orderItem.deleteMany()
  await testDb.order.deleteMany()
  await testDb.product.deleteMany()
  await testDb.category.deleteMany()
  await testDb.coupon.deleteMany()

  // Seed Category
  const category = await testDb.category.create({
    data: {
      id: 'cat-test',
      name: 'Organic Ghee & Oils',
      slug: 'organic-ghee-oils',
    },
  })

  // Seed Products
  const prod1 = await testDb.product.create({
    data: {
      id: 'p-oil',
      name: 'Cold Pressed Mustard Oil 1L',
      slug: 'mustard-oil-1l',
      price: 450,
      stock: 10,
      categoryId: category.id,
    },
  })

  const prod2 = await testDb.product.create({
    data: {
      id: 'p-honey',
      name: 'Pure Sundarban Honey 500g',
      slug: 'sundarban-honey-500g',
      price: 650,
      stock: 5,
      categoryId: category.id,
    },
  })

  // Seed Coupon
  const coupon = await testDb.coupon.create({
    data: {
      id: 'c-off100',
      code: 'OFF100',
      value: 100,
      usedCount: 1,
      usageLimit: 50,
      validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  })

  return { category, prod1, prod2, coupon }
}

test('1. Prisma Integration: simultaneous duplicate IPN', async () => {
  const { prod1 } = await setupTestEnvironment()

  // Create pending order with reserved stock
  const order = await testDb.order.create({
    data: {
      id: 'ord-sim-ipn',
      orderNumber: 'KK-SIM-01',
      totalAmount: 900,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      stockReserved: true,
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      items: {
        create: [
          {
            productId: prod1.id,
            productName: prod1.name,
            quantity: 2,
            unit: 'kg',
            price: 450,
          },
        ],
      },
    },
  })

  // Execute two simultaneous duplicate IPN requests via Promise.all
  const [res1, res2] = await Promise.all([
    finalizeOrderPayment({
      orderId: order.id,
      transactionId: 'TXN-DUAL-1',
      dbClient: testDb,
    }),
    finalizeOrderPayment({
      orderId: order.id,
      transactionId: 'TXN-DUAL-2',
      dbClient: testDb,
    }),
  ])

  // Exactly one must claim payment finalization, the other must detect alreadyPaid
  const finalizerCount = [res1, res2].filter((r) => r.success && !r.alreadyPaid).length
  const duplicateCount = [res1, res2].filter((r) => r.success && r.alreadyPaid).length

  assert.equal(finalizerCount, 1, 'Exactly one IPN transaction claimed payment')
  assert.equal(duplicateCount, 1, 'The duplicate IPN was idempotent')

  // Verify database state
  const updatedOrder = await testDb.order.findUnique({ where: { id: order.id } })
  assert.equal(updatedOrder.paymentStatus, 'paid')
  assert.equal(updatedOrder.orderStatus, 'confirmed')
  assert.equal(updatedOrder.stockReserved, true, 'Stock remains locked')
  assert.equal(updatedOrder.reservationExpiresAt, null, 'Expiry timestamp was cleared')

  // Verify status history has exactly 1 entry
  const histories = await testDb.orderStatusHistory.findMany({ where: { orderId: order.id } })
  assert.equal(histories.length, 1, 'OrderStatusHistory was written exactly once')
})

test('2. Prisma Integration: IPN বনাম browser cancel redirect', async () => {
  const { prod1 } = await setupTestEnvironment()

  // Order with 2 reserved items (prod stock was decremented from 10 to 8 on creation)
  await testDb.product.update({ where: { id: prod1.id }, data: { stock: 8 } })

  const order = await testDb.order.create({
    data: {
      id: 'ord-ipn-vs-browser',
      orderNumber: 'KK-IPN-BR',
      totalAmount: 900,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      stockReserved: true,
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      items: {
        create: [
          {
            productId: prod1.id,
            productName: prod1.name,
            quantity: 2,
            unit: 'kg',
            price: 450,
          },
        ],
      },
    },
  })

  // Simulate non-authoritative browser cancel redirect:
  // Under Phase 1B.1, browser cancel does NOT mutate order or release stock
  // (It only logs diagnostic audit without state transition).
  await testDb.auditLog.create({
    data: {
      action: 'payment_browser_cancel_redirect',
      module: 'payments',
      referenceId: order.id,
      newData: JSON.stringify({ browserKind: 'cancel', note: 'Non-authoritative browser return' }),
    },
  })

  // Now the authoritative server-side IPN arrives with valid payment
  const ipnResult = await finalizeOrderPayment({
    orderId: order.id,
    transactionId: 'TXN-AUTH-IPN',
    dbClient: testDb,
  })

  assert.equal(ipnResult.success, true)
  assert.equal(ipnResult.alreadyPaid, false)

  // Verify database state: order is confirmed paid, stock was NOT restored
  const freshOrder = await testDb.order.findUnique({ where: { id: order.id } })
  assert.equal(freshOrder.paymentStatus, 'paid')
  assert.equal(freshOrder.orderStatus, 'confirmed')

  const freshProduct = await testDb.product.findUnique({ where: { id: prod1.id } })
  assert.equal(freshProduct.stock, 8, 'Product stock remained at 8 (never erroneously restored)')
})

test('3. Prisma Integration: duplicate expiry cron', async () => {
  const { prod1 } = await setupTestEnvironment()

  // Decrement stock by 4 (initial stock was 10, now 6)
  await testDb.product.update({ where: { id: prod1.id }, data: { stock: 6 } })

  const pastExpiry = new Date(Date.now() - 10 * 60 * 1000) // Expired 10 minutes ago
  const order = await testDb.order.create({
    data: {
      id: 'ord-expired-cron',
      orderNumber: 'KK-EXP-01',
      totalAmount: 1800,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      stockReserved: true,
      reservationExpiresAt: pastExpiry,
      items: {
        create: [
          {
            productId: prod1.id,
            productName: prod1.name,
            quantity: 4,
            unit: 'kg',
            price: 450,
          },
        ],
      },
    },
  })

  // Two cron workers trigger expirePendingOrders at the exact same millisecond
  const [cronA, cronB] = await Promise.all([
    expirePendingOrders({ cutoffDate: new Date(), dbClient: testDb }),
    expirePendingOrders({ cutoffDate: new Date(), dbClient: testDb }),
  ])

  // Total expired count across both runs must be exactly 1
  assert.equal(cronA.expiredCount + cronB.expiredCount, 1, 'Only one cron worker expired the order')

  // Verify database state
  const updatedOrder = await testDb.order.findUnique({ where: { id: order.id } })
  assert.equal(updatedOrder.paymentStatus, 'expired')
  assert.equal(updatedOrder.orderStatus, 'cancelled')
  assert.equal(updatedOrder.stockReserved, false)

  // Verify stock was restored exactly once (6 + 4 = 10, not 6 + 8 = 14)
  const freshProduct = await testDb.product.findUnique({ where: { id: prod1.id } })
  assert.equal(freshProduct.stock, 10, 'Stock restored to exactly 10, zero double-increment')
})

test('4. Prisma Integration: successful payment বনাম late failure callback', async () => {
  const { prod1 } = await setupTestEnvironment()
  await testDb.product.update({ where: { id: prod1.id }, data: { stock: 8 } })

  const order = await testDb.order.create({
    data: {
      id: 'ord-paid-first',
      orderNumber: 'KK-PAID-01',
      totalAmount: 900,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      stockReserved: true,
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      items: {
        create: [
          {
            productId: prod1.id,
            productName: prod1.name,
            quantity: 2,
            unit: 'kg',
            price: 450,
          },
        ],
      },
    },
  })

  // 1. Authoritative IPN marks order paid
  const payResult = await finalizeOrderPayment({
    orderId: order.id,
    transactionId: 'TXN-PAID-LEGIT',
    dbClient: testDb,
  })
  assert.equal(payResult.success, true)

  // 2. A late, stale, or buggy failure callback arrives afterwards
  const lateFailResult = await releaseOrderInventoryAndCoupon({
    orderId: order.id,
    reason: 'Stale delayed failure callback',
    paymentStatus: 'failed',
    orderStatus: 'cancelled',
    dbClient: testDb,
  })

  // Late failure must be safely rejected / marked alreadyReleased without modifying database
  assert.equal(lateFailResult.alreadyReleased, true)
  assert.equal(lateFailResult.restoredStock, 0)

  // Verify database remains paid and confirmed
  const checkOrder = await testDb.order.findUnique({ where: { id: order.id } })
  assert.equal(checkOrder.paymentStatus, 'paid')
  assert.equal(checkOrder.orderStatus, 'confirmed')

  const checkProduct = await testDb.product.findUnique({ where: { id: prod1.id } })
  assert.equal(checkProduct.stock, 8, 'Product stock was not restored')
})

test('5. Prisma Integration: stock/coupon exactly once restore under concurrent release requests', async () => {
  const { prod1, coupon } = await setupTestEnvironment()

  // Stock initially 6 (4 units in order)
  await testDb.product.update({ where: { id: prod1.id }, data: { stock: 6 } })
  // Coupon usedCount = 2 (1 used in this order)
  await testDb.coupon.update({ where: { id: coupon.id }, data: { usedCount: 2 } })

  const order = await testDb.order.create({
    data: {
      id: 'ord-concurrent-release',
      orderNumber: 'KK-CR-01',
      totalAmount: 1700,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      stockReserved: true,
      couponReleased: false,
      couponCode: coupon.code,
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      items: {
        create: [
          {
            productId: prod1.id,
            productName: prod1.name,
            quantity: 4,
            unit: 'kg',
            price: 450,
          },
        ],
      },
    },
  })

  // 4 concurrent release requests simultaneously hit the database
  const results = await Promise.all([
    releaseOrderInventoryAndCoupon({ orderId: order.id, reason: 'Cancel event 1', dbClient: testDb }),
    releaseOrderInventoryAndCoupon({ orderId: order.id, reason: 'Cancel event 2', dbClient: testDb }),
    releaseOrderInventoryAndCoupon({ orderId: order.id, reason: 'Cancel event 3', dbClient: testDb }),
    releaseOrderInventoryAndCoupon({ orderId: order.id, reason: 'Cancel event 4', dbClient: testDb }),
  ])

  // Exactly one must have restored stock; all other 3 must report alreadyReleased = true
  const successfulRestorers = results.filter((r) => r.success && !r.alreadyReleased)
  const noOpRestorers = results.filter((r) => r.success && r.alreadyReleased)

  assert.equal(successfulRestorers.length, 1, 'Exactly one transaction claimed the release')
  assert.equal(noOpRestorers.length, 3, 'Three concurrent transactions were no-ops')

  // Verify stock in database: 6 + 4 = exactly 10
  const finalProduct = await testDb.product.findUnique({ where: { id: prod1.id } })
  assert.equal(finalProduct.stock, 10, 'Product stock is exactly 10')

  // Verify coupon usedCount in database: 2 - 1 = exactly 1
  const finalCoupon = await testDb.coupon.findUnique({ where: { id: coupon.id } })
  assert.equal(finalCoupon.usedCount, 1, 'Coupon usedCount decremented exactly once')

  // Verify order flags
  const finalOrder = await testDb.order.findUnique({ where: { id: order.id } })
  assert.equal(finalOrder.stockReserved, false)
  assert.equal(finalOrder.couponReleased, true)
  assert.equal(finalOrder.orderStatus, 'cancelled')
})

test.after(async () => {
  await testDb.$disconnect()
})
