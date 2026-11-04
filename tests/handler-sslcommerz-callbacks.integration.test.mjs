import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { NextRequest } from 'next/server.js'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()

// Ensure global prisma instance points to our test database
globalThis.prisma = testDb

// Configure test SSLCOMMERZ credentials
process.env.SSLCOMMERZ_STORE_ID = 'test_store_id'
process.env.SSLCOMMERZ_STORE_PASSWORD = 'test_store_password'
process.env.SSLCOMMERZ_IS_LIVE = 'false'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

// Import route handlers
const { POST: postSuccess, GET: getSuccess } = await import('../src/app/api/payments/sslcommerz/success/route.ts')
const { POST: postFail, GET: getFail } = await import('../src/app/api/payments/sslcommerz/fail/route.ts')
const { POST: postCancel, GET: getCancel } = await import('../src/app/api/payments/sslcommerz/cancel/route.ts')
const { POST: postIpn } = await import('../src/app/api/payments/sslcommerz/ipn/route.ts')

// Helper to compute genuine SSLCommerz MD5 signature for IPN testing
function computeSignature(payload, storePassword) {
  const verifyKey = Object.keys(payload).join(',')
  const hashData = { ...payload }
  hashData.store_passwd = crypto.createHash('md5').update(storePassword).digest('hex')

  const hashString = Object.keys(hashData)
    .sort()
    .map((key) => `${key}=${hashData[key]}`)
    .join('&')

  const verifySign = crypto.createHash('md5').update(hashString).digest('hex')
  return { verify_sign: verifySign, verify_key: verifyKey }
}

async function setupTestEnvironment() {
  await testDb.auditLog.deleteMany()
  await testDb.orderStatusHistory.deleteMany()
  await testDb.payment.deleteMany()
  await testDb.deliveryLabel.deleteMany()
  await testDb.orderItem.deleteMany()
  await testDb.order.deleteMany()
  await testDb.product.deleteMany()
  await testDb.category.deleteMany()
  await testDb.coupon.deleteMany()
  await testDb.siteConfig.deleteMany()

  await testDb.siteConfig.createMany({
    data: [
      { key: 'sslcommerzStoreId', value: 'test_store_id' },
      { key: 'sslcommerzPassword', value: 'test_store_password' },
      { key: 'sslcommerzMode', value: 'sandbox' },
    ],
  })

  const category = await testDb.category.create({
    data: {
      id: 'cat-cb-test',
      name: 'Organic Honey & Ghee',
      slug: 'organic-honey-ghee',
    },
  })

  const product = await testDb.product.create({
    data: {
      id: 'prod-cb-1',
      name: 'Sundarban Raw Honey 500g',
      slug: 'sundarban-raw-honey-500g',
      price: 450,
      stock: 10,
      categoryId: category.id,
    },
  })

  const coupon = await testDb.coupon.create({
    data: {
      id: 'coupon-cb-1',
      code: 'KHATI100',
      value: 100,
      usedCount: 1,
      usageLimit: 50,
      validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  })

  return { category, product, coupon }
}

test('1. Handler-level: browser success/fail/cancel callback route never mutates Order or Payment fields', async () => {
  const { product, coupon } = await setupTestEnvironment()

  // Create pending order with reserved stock
  const order = await testDb.order.create({
    data: {
      id: 'ord-br-noop-01',
      orderNumber: 'KK-NOOP-01',
      totalAmount: 900,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      stockReserved: true,
      couponCode: coupon.code,
      couponReleased: false,
      items: {
        create: [
          {
            id: 'item-noop-1',
            productId: product.id,
            productName: product.name,
            unit: 'jar',
            quantity: 2,
            price: 450,
          },
        ],
      },
    },
  })

  // Create initial payment in pending status
  const payment = await testDb.payment.create({
    data: {
      id: 'pay-noop-01',
      orderId: order.id,
      method: 'online',
      gateway: 'sslcommerz',
      transactionId: 'TRAN-LEGIT-101',
      status: 'pending',
      amount: 900,
      gatewayResponse: null,
      paidAt: null,
    },
  })

  // A. Invoke browser SUCCESS route (POST)
  const reqSuccess = new NextRequest('http://localhost:3000/api/payments/sslcommerz/success', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      value_a: order.id,
      tran_id: 'TRAN-LEGIT-101',
      status: 'VALID',
      val_id: 'VAL-TEST-999',
      amount: '900.00',
    }),
  })
  const resSuccess = await postSuccess(reqSuccess)
  assert.equal(resSuccess.status, 307)
  const locSuccess = resSuccess.headers.get('location')
  assert.ok(locSuccess.includes('payment=success'))
  assert.ok(locSuccess.includes(`orderId=${order.id}`))

  // Verify order and payment did NOT mutate
  let orderAfterSuccess = await testDb.order.findUnique({ where: { id: order.id } })
  let paymentAfterSuccess = await testDb.payment.findUnique({ where: { orderId: order.id } })
  assert.equal(orderAfterSuccess.paymentStatus, 'pending', 'Order paymentStatus must remain pending')
  assert.equal(orderAfterSuccess.orderStatus, 'pending', 'Order orderStatus must remain pending')
  assert.equal(orderAfterSuccess.stockReserved, true, 'Stock reservation must remain true')
  assert.equal(paymentAfterSuccess.status, 'pending', 'Payment status must remain pending')
  assert.equal(paymentAfterSuccess.paidAt, null, 'Payment paidAt must remain null')

  // B. Invoke browser FAIL route (POST)
  const reqFail = new NextRequest('http://localhost:3000/api/payments/sslcommerz/fail', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      value_a: order.id,
      tran_id: 'TRAN-LEGIT-101',
      status: 'FAILED',
    }),
  })
  const resFail = await postFail(reqFail)
  assert.equal(resFail.status, 307)
  const locFail = resFail.headers.get('location')
  assert.ok(locFail.includes('payment=fail'))

  // Verify order and payment did NOT mutate
  let orderAfterFail = await testDb.order.findUnique({ where: { id: order.id } })
  let paymentAfterFail = await testDb.payment.findUnique({ where: { orderId: order.id } })
  assert.equal(orderAfterFail.paymentStatus, 'pending', 'Fail redirect must not set paymentStatus to failed')
  assert.equal(orderAfterFail.orderStatus, 'pending', 'Fail redirect must not set orderStatus to cancelled')
  assert.equal(orderAfterFail.stockReserved, true, 'Fail redirect must not release reserved stock')
  assert.equal(paymentAfterFail.status, 'pending', 'Fail redirect must not mutate payment status')

  // C. Invoke browser CANCEL route (GET)
  const reqCancel = new NextRequest(`http://localhost:3000/api/payments/sslcommerz/cancel?value_a=${order.id}&tran_id=TRAN-LEGIT-101`, {
    method: 'GET',
  })
  const resCancel = await getCancel(reqCancel)
  assert.equal(resCancel.status, 307)
  const locCancel = resCancel.headers.get('location')
  assert.ok(locCancel.includes('payment=cancel'))

  // Verify product stock and coupon count are untouched
  const prodCheck = await testDb.product.findUnique({ where: { id: product.id } })
  assert.equal(prodCheck.stock, 10, 'Product stock must remain untouched')
  const couponCheck = await testDb.coupon.findUnique({ where: { id: coupon.id } })
  assert.equal(couponCheck.usedCount, 1, 'Coupon usage count must remain untouched')
})

test('2. Handler-level: forged browser transaction ID cannot mutate database state', async () => {
  const { product } = await setupTestEnvironment()

  const order = await testDb.order.create({
    data: {
      id: 'ord-forged-01',
      orderNumber: 'KK-FORGE-01',
      totalAmount: 900,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      stockReserved: true,
      items: {
        create: [
          {
            id: 'item-forge-1',
            productId: product.id,
            productName: product.name,
            unit: 'jar',
            quantity: 2,
            price: 450,
          },
        ],
      },
    },
  })

  await testDb.payment.create({
    data: {
      id: 'pay-forged-01',
      orderId: order.id,
      method: 'online',
      gateway: 'sslcommerz',
      transactionId: 'TRAN-AUTHENTIC-444',
      status: 'pending',
      amount: 900,
      paidAt: null,
    },
  })

  // Attacker posts forged tran_id and claims VALID status to browser success callback
  const reqForged = new NextRequest('http://localhost:3000/api/payments/sslcommerz/success', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      value_a: order.id,
      tran_id: 'FORGED-HACKER-TX-999',
      status: 'VALID',
      val_id: 'FAKE-VAL-12345',
      amount: '1.00',
    }),
  })

  const res = await postSuccess(reqForged)
  assert.equal(res.status, 307)

  // Verify DB state is 100% untouched
  const orderDb = await testDb.order.findUnique({ where: { id: order.id } })
  const paymentDb = await testDb.payment.findUnique({ where: { orderId: order.id } })

  assert.equal(orderDb.paymentStatus, 'pending', 'Order paymentStatus must remain pending despite forged claim')
  assert.equal(paymentDb.transactionId, 'TRAN-AUTHENTIC-444', 'Transaction ID must NOT be overwritten by forged tran_id')
  assert.equal(paymentDb.status, 'pending', 'Payment status must NOT be changed to paid')
  assert.equal(paymentDb.amount, 900, 'Payment amount must NOT be altered')
  assert.equal(paymentDb.paidAt, null, 'Payment paidAt must remain null')
})

test('3. Handler-level: validated IPN successfully transitions order to paid', async () => {
  const { product } = await setupTestEnvironment()

  const order = await testDb.order.create({
    data: {
      id: 'ord-ipn-valid-01',
      orderNumber: 'KK-IPN-VAL-01',
      totalAmount: 900,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      stockReserved: true,
      items: {
        create: [
          {
            id: 'item-ipn-val-1',
            productId: product.id,
            productName: product.name,
            unit: 'jar',
            quantity: 2,
            price: 450,
          },
        ],
      },
    },
  })

  await testDb.payment.create({
    data: {
      id: 'pay-ipn-val-01',
      orderId: order.id,
      method: 'online',
      gateway: 'sslcommerz',
      transactionId: 'TRAN-IPN-LEGIT-777',
      status: 'pending',
      amount: 900,
      paidAt: null,
    },
  })

  // Prepare signed IPN payload
  const basePayload = {
    amount: '900.00',
    currency_amount: '900.00',
    status: 'VALID',
    tran_id: 'TRAN-IPN-LEGIT-777',
    val_id: 'VAL-IPN-CONFIRMED-777',
    value_a: order.id,
  }
  const { verify_sign, verify_key } = computeSignature(basePayload, 'test_store_password')
  const ipnPayload = { ...basePayload, verify_sign, verify_key }

  // Intercept SSLCommerz validation API call during test
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('validationserverAPI.php')) {
      return new Response(
        JSON.stringify({
          status: 'VALID',
          amount: '900.00',
          currency_amount: '900.00',
          val_id: 'VAL-IPN-CONFIRMED-777',
          tran_id: 'TRAN-IPN-LEGIT-777',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }
    return originalFetch(url, options)
  }

  try {
    const reqIpn = new NextRequest('http://localhost:3000/api/payments/sslcommerz/ipn', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(ipnPayload),
    })

    const res = await postIpn(reqIpn)
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.success, true)
    assert.equal(json.data.status, 'paid')

    // Verify database state: order paid & confirmed, stock finalized
    const orderDb = await testDb.order.findUnique({ where: { id: order.id } })
    const paymentDb = await testDb.payment.findUnique({ where: { orderId: order.id } })

    assert.equal(orderDb.paymentStatus, 'paid')
    assert.equal(orderDb.orderStatus, 'confirmed')
    assert.equal(orderDb.stockReserved, true, 'Stock remains locked for paid order')
    assert.equal(orderDb.reservationExpiresAt, null, 'Expiry timer is cleared')
    assert.equal(paymentDb.status, 'paid')
    assert.ok(paymentDb.paidAt !== null, 'Payment paidAt must be set')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('4. Handler-level: authoritative IPN failure transitions order to failed and releases stock & coupon', async () => {
  const { product, coupon } = await setupTestEnvironment()

  // Order with 2 reserved honey jars, product stock was 10 -> now 8
  await testDb.product.update({
    where: { id: product.id },
    data: { stock: 8 },
  })

  const order = await testDb.order.create({
    data: {
      id: 'ord-ipn-fail-01',
      orderNumber: 'KK-IPN-FAIL-01',
      totalAmount: 900,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      stockReserved: true,
      couponCode: coupon.code,
      couponReleased: false,
      items: {
        create: [
          {
            id: 'item-ipn-fail-1',
            productId: product.id,
            productName: product.name,
            unit: 'jar',
            quantity: 2,
            price: 450,
          },
        ],
      },
    },
  })

  await testDb.payment.create({
    data: {
      id: 'pay-ipn-fail-01',
      orderId: order.id,
      method: 'online',
      gateway: 'sslcommerz',
      transactionId: 'TRAN-IPN-FAIL-888',
      status: 'pending',
      amount: 900,
      paidAt: null,
    },
  })

  // IPN reports payment failure
  const reqIpn = new NextRequest('http://localhost:3000/api/payments/sslcommerz/ipn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      value_a: order.id,
      tran_id: 'TRAN-IPN-FAIL-888',
      status: 'FAILED',
      amount: '900.00',
    }),
  })

  const res = await postIpn(reqIpn)
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.equal(json.success, true)
  assert.equal(json.data.status, 'failed')
  assert.equal(json.data.inventoryReleased, true)

  // Verify DB state
  const orderDb = await testDb.order.findUnique({ where: { id: order.id } })
  const paymentDb = await testDb.payment.findUnique({ where: { orderId: order.id } })
  const productDb = await testDb.product.findUnique({ where: { id: product.id } })
  const couponDb = await testDb.coupon.findUnique({ where: { id: coupon.id } })

  assert.equal(orderDb.paymentStatus, 'failed')
  assert.equal(orderDb.orderStatus, 'cancelled')
  assert.equal(orderDb.stockReserved, false)
  assert.equal(orderDb.couponReleased, true)
  assert.equal(paymentDb.status, 'failed')

  // Stock must be restored from 8 -> 10
  assert.equal(productDb.stock, 10, 'Reserved stock must be restored to 10')

  // Coupon usage must be decremented from 1 -> 0
  assert.equal(couponDb.usedCount, 0, 'Coupon usage must be decremented to 0')
})

test('5. Handler-level: browser callback writes minimal append-only audit log with no secrets or raw gateway payload', async () => {
  const { product } = await setupTestEnvironment()

  const order = await testDb.order.create({
    data: {
      id: 'ord-audit-sec-01',
      orderNumber: 'KK-AUDIT-01',
      totalAmount: 900,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      stockReserved: true,
      items: {
        create: [
          {
            id: 'item-aud-1',
            productId: product.id,
            productName: product.name,
            unit: 'jar',
            quantity: 2,
            price: 450,
          },
        ],
      },
    },
  })

  // Post browser redirect containing sensitive gateway fields
  const req = new NextRequest('http://localhost:3000/api/payments/sslcommerz/success', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      value_a: order.id,
      tran_id: 'TRAN-AUDIT-01',
      status: 'VALID',
      card_no: '1234567890123456',
      store_passwd: 'SUPER_SECRET_STORE_PASSWORD',
      verify_sign: 'abcdef123456',
      val_id: 'VAL-SECRET-999',
    }),
  })

  await postSuccess(req)

  // Verify AuditLog entries
  const logs = await testDb.auditLog.findMany({
    where: { referenceId: order.id },
  })

  assert.ok(logs.length >= 1, 'An audit log entry must be created')
  const entry = logs[0]
  assert.equal(entry.action, 'payment_browser_success_redirect')
  assert.equal(entry.module, 'payments')

  // Parse newData
  const loggedData = JSON.parse(entry.newData || '{}')
  assert.equal(loggedData.orderId, order.id)
  assert.equal(loggedData.browserKind, 'success')

  // STRICT CHECK: Raw gateway payload and secrets must NEVER be logged
  assert.equal(loggedData.card_no, undefined, 'card_no must NOT be present in audit log')
  assert.equal(loggedData.store_passwd, undefined, 'store_passwd must NOT be present in audit log')
  assert.equal(loggedData.verify_sign, undefined, 'verify_sign must NOT be present in audit log')
  assert.equal(loggedData.val_id, undefined, 'val_id must NOT be present in audit log')
  assert.equal(loggedData.rawPayload, undefined, 'rawPayload must NOT be present in audit log')
})

test.after(async () => {
  await testDb.$disconnect()
})

