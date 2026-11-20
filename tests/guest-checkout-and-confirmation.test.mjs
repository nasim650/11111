/**
 * guest-checkout-and-confirmation.test.mjs
 * Comprehensive integration test suite verifying:
 * 1. Guest unverified phone rejected with PHONE_UNVERIFIED
 * 2. Guest OTP send/verify issues valid short-lived checkoutProof
 * 3. Guest verified checkout creates order with guestAccessTokenHash
 * 4. Guest COD order confirmation returns 200 with complete details
 * 5. Guest cookie cannot open another guest order (returns 404)
 * 6. Invalid/expired guest token returns 404 and leaks zero data
 * 7. Logged-in customer sees only own order
 * 8. Customer A cannot see Customer B order (returns 404)
 * 9. Admin sees order without raw secrets/credentials
 * 10. Registered unverified phone is blocked until OTP verified
 * 11. Online payment option controlled by site setting
 * 12. Missing SSLCOMMERZ config gives safe 503 fallback without secret leaks
 * 13. Guest online payment initiation requires valid guest access proof (403 without proof)
 * 14. Browser payment callback produces zero DB mutation
 * 15. Server-side IPN remains authoritative
 * 16. Registration and checkout contract verification
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { NextRequest } from 'next/server.js'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()

globalThis.prisma = testDb

// Environment setup for testing
process.env.NODE_ENV = 'test'
process.env.APP_SECRET = 'test-secret-key-at-least-32-chars-long-for-hmac'
process.env.NEXTAUTH_SECRET = 'test-secret-key-at-least-32-chars-long-for-hmac'
process.env.OTP_SECRET = 'test-secret-at-least-32-characters-long'
process.env.BULKSMSBD_API_KEY = 'mock-test-key'
process.env.BULKSMSBD_SENDER_ID = 'KHATI_KHADYO'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

const { setBulkSmsMockTransport } = await import('../src/lib/bulksmsbd.ts')
const { POST: postGuestOtpSend } = await import('../src/app/api/auth/guest-phone/send/route.ts')
const { POST: postGuestOtpVerify } = await import('../src/app/api/auth/guest-phone/verify/route.ts')
const { POST: postOrder } = await import('../src/app/api/orders/route.ts')
const { POST: postPaymentInitiate } = await import('../src/app/api/payments/sslcommerz/initiate/route.ts')
const { getOrderForUser } = await import('../src/lib/order-authorization.ts')
const { createCheckoutProof, verifyCheckoutProof } = await import('../src/lib/checkout-proof.ts')
const { generateToken } = await import('../src/lib/auth.ts')
const { handleSSLCommerzCallback } = await import('../src/app/api/payments/sslcommerz/handler.ts')
const { validateRegistration } = await import('../src/lib/validation.ts')
const { POST: postRegister } = await import('../src/app/api/auth/register/route.ts')

// Helper function to create JSON requests with standard headers
function makeReq(url, body = {}, headers = {}, cookies = {}) {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .concat('csrf_token=test-csrf')
    .join('; ')

  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': 'test-csrf',
      cookie: cookieHeader,
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

// Clean test database before run
async function cleanDatabase() {
  await testDb.orderItem.deleteMany()
  await testDb.payment.deleteMany()
  await testDb.deliveryLabel.deleteMany()
  await testDb.orderStatusHistory.deleteMany()
  await testDb.order.deleteMany()
  await testDb.otpChallenge.deleteMany().catch(() => {})
  await testDb.cartItem.deleteMany()
  await testDb.productImage.deleteMany()
  await testDb.product.deleteMany()
  await testDb.category.deleteMany()
  await testDb.user.deleteMany()
  await testDb.siteConfig.deleteMany()
}

// Ensure active test category and product
async function setupProduct() {
  const category = await testDb.category.upsert({
    where: { slug: 'test-category' },
    update: {},
    create: { name: 'Test Category', slug: 'test-category' },
  })

  return await testDb.product.create({
    data: {
      name: 'Organic Mustard Oil 1L',
      slug: `mustard-oil-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      categoryId: category.id,
      price: 320,
      stock: 50,
      unit: 'bottle',
      status: 'active',
    },
  })
}

test('1. Guest unverified phone -> order creation rejected with explicit verification requirement', async () => {
  await cleanDatabase()
  const product = await setupProduct()

  const req = makeReq('http://localhost:3000/api/orders', {
    items: [{ productId: product.id, quantity: 1 }],
    shippingMethod: 'standard',
    paymentMethod: 'cod',
    guestName: 'Unverified Guest',
    guestPhone: '01711000001',
    guestAddress: 'Dhanmondi, Dhaka',
    // checkoutProof omitted
  })

  const res = await postOrder(req)
  const data = await res.json()

  assert.equal(res.status, 403, 'Should return 403 for unverified guest')
  assert.equal(data.success, false)
  assert.equal(data.code, 'PHONE_UNVERIFIED')
  assert.ok(data.error.includes('ওটিপি দিয়ে ভেরিফাই করুন'))
})

test('2. Guest OTP send/verify -> valid short-lived checkout proof created', async () => {
  const phone = '01711000002'
  let capturedCode = null

  setBulkSmsMockTransport(async (payload) => {
    const match = payload.message.match(/(\d{6})/)
    if (match) capturedCode = match[1]
    return {
      success: true,
      messageId: 'mock-guest-12345',
      responseCode: 202,
      rawResponse: JSON.stringify({ response_code: 202 }),
    }
  })

  // Send OTP
  const sendReq = makeReq('http://localhost:3000/api/auth/guest-phone/send', { phone })
  const sendRes = await postGuestOtpSend(sendReq)
  const sendData = await sendRes.json()

  assert.equal(sendRes.status, 200)
  assert.equal(sendData.success, true)
  assert.equal(sendData.data.phone, phone)
  assert.ok(capturedCode, 'Must capture generated 6-digit OTP from mock SMS transport')

  // Verify OTP
  const verifyReq = makeReq('http://localhost:3000/api/auth/guest-phone/verify', {
    phone,
    code: capturedCode,
  })
  const verifyRes = await postGuestOtpVerify(verifyReq)
  const verifyData = await verifyRes.json()

  assert.equal(verifyRes.status, 200)
  assert.equal(verifyData.success, true)
  assert.ok(verifyData.data.checkoutProof, 'Must return checkoutProof')

  // Verify proof cryptographically
  const isValid = verifyCheckoutProof(verifyData.data.checkoutProof, phone)
  assert.equal(isValid, true, 'Cryptographic signature of checkout proof must verify')
})

test('3. Guest verified checkout -> order created successfully with guestAccessTokenHash', async () => {
  const product = await setupProduct()
  const phone = '01711000003'
  const proof = createCheckoutProof(phone)

  const req = makeReq('http://localhost:3000/api/orders', {
    items: [{ productId: product.id, quantity: 2 }],
    shippingMethod: 'standard',
    paymentMethod: 'cod',
    guestName: 'Verified Guest',
    guestPhone: phone,
    guestAddress: 'Gulshan 2, Dhaka',
    checkoutProof: proof,
  })

  const res = await postOrder(req)
  const data = await res.json()

  assert.equal(res.status, 201, 'Order must be created with 201')
  assert.equal(data.success, true)
  assert.ok(data.data.orderNumber)
  assert.ok(data.guestAccessToken, 'Must return raw guestAccessToken in response')

  // Verify DB contains only hash, never raw token
  const dbOrder = await testDb.order.findUnique({
    where: { orderNumber: data.data.orderNumber },
  })
  assert.ok(dbOrder.guestAccessTokenHash, 'guestAccessTokenHash must be stored in DB')
  assert.notEqual(dbOrder.guestAccessTokenHash, data.guestAccessToken, 'DB hash must not equal raw token')

  // Verify Set-Cookie header exists
  const cookieHeader = res.headers.get('set-cookie')
  assert.ok(cookieHeader && cookieHeader.includes('guest_order_access='), 'Response must set guest_order_access cookie')
})

test('4. Guest COD order -> confirmation/order page returns 200, never 404', async () => {
  const product = await setupProduct()
  const phone = '01711000004'
  const proof = createCheckoutProof(phone)

  const orderReq = makeReq('http://localhost:3000/api/orders', {
    items: [{ productId: product.id, quantity: 1 }],
    shippingMethod: 'standard',
    paymentMethod: 'cod',
    guestName: 'Confirmation Guest',
    guestPhone: phone,
    guestAddress: 'Uttara, Dhaka',
    checkoutProof: proof,
  })

  const orderRes = await postOrder(orderReq)
  const orderData = await orderRes.json()
  const rawGuestToken = orderData.guestAccessToken
  const orderNumber = orderData.data.orderNumber

  // Call getOrderForUser with rawGuestToken (representing guest cookie access)
  const result = await getOrderForUser(orderNumber, null, testDb, rawGuestToken)

  assert.equal(result.status, 200, 'Confirmation must return 200 OK for valid guest token')
  assert.ok(result.order, 'Order details must be returned')
  assert.equal(result.order.orderNumber, orderNumber)
  assert.equal(result.order.guestPhone, phone)
  assert.equal(result.order.items.length, 1)
})

test('5. Guest cookie cannot open another guest order', async () => {
  const product = await setupProduct()

  // Order A
  const phoneA = '01711000005'
  const orderARes = await postOrder(
    makeReq('http://localhost:3000/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'standard',
      paymentMethod: 'cod',
      guestName: 'Guest A',
      guestPhone: phoneA,
      guestAddress: 'Mirpur, Dhaka',
      checkoutProof: createCheckoutProof(phoneA),
    })
  )
  const orderAData = await orderARes.json()
  const tokenA = orderAData.guestAccessToken

  // Order B
  const phoneB = '01711000006'
  const orderBRes = await postOrder(
    makeReq('http://localhost:3000/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'standard',
      paymentMethod: 'cod',
      guestName: 'Guest B',
      guestPhone: phoneB,
      guestAddress: 'Banani, Dhaka',
      checkoutProof: createCheckoutProof(phoneB),
    })
  )
  const orderBData = await orderBRes.json()
  const orderBNumber = orderBData.data.orderNumber

  // Try to access Order B using Token A
  const crossResult = await getOrderForUser(orderBNumber, null, testDb, tokenA)

  assert.equal(crossResult.status, 404, 'Mismatched guest token must return 404')
  assert.equal(crossResult.order, null, 'Must leak zero details of Order B')
})

test('6. Invalid/expired guest access token -> no order data leak', async () => {
  const product = await setupProduct()
  const phone = '01711000007'
  const orderRes = await postOrder(
    makeReq('http://localhost:3000/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'standard',
      paymentMethod: 'cod',
      guestName: 'Guest Expiry Test',
      guestPhone: phone,
      guestAddress: 'Mohakhali, Dhaka',
      checkoutProof: createCheckoutProof(phone),
    })
  )
  const orderData = await orderRes.json()
  const orderNumber = orderData.data.orderNumber

  // Manually expire the token in database
  await testDb.order.update({
    where: { orderNumber },
    data: { guestAccessExpiresAt: new Date(Date.now() - 1000) },
  })

  // Query with expired token
  const expiredResult = await getOrderForUser(orderNumber, null, testDb, orderData.guestAccessToken)
  assert.equal(expiredResult.status, 404, 'Expired guest token must return 404')
  assert.equal(expiredResult.order, null)

  // Query with completely random token
  const randomResult = await getOrderForUser(orderNumber, null, testDb, 'random-token-12345678')
  assert.equal(randomResult.status, 404, 'Invalid guest token must return 404')
  assert.equal(randomResult.order, null)
})

test('7. Logged-in customer sees only own order', async () => {
  const product = await setupProduct()
  const user = await testDb.user.create({
    data: {
      name: 'Customer One',
      phone: '01711000010',
      email: 'customer1@example.com',
      role: 'customer',
      isVerified: true,
      sessionVersion: 1,
    },
  })

  const order = await testDb.order.create({
    data: {
      orderNumber: `ORD-OWN-${Date.now()}`,
      userId: user.id,
      totalAmount: 320,
      deliveryCharge: 60,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      items: {
        create: [{ productId: product.id, productName: product.name, quantity: 1, unit: 'bottle', price: 320 }],
      },
    },
  })

  const result = await getOrderForUser(order.orderNumber, { userId: user.id, role: user.role }, testDb)
  assert.equal(result.status, 200)
  assert.equal(result.order.orderNumber, order.orderNumber)
})

test('8. Customer A cannot see customer B order', async () => {
  const product = await setupProduct()
  const customerA = await testDb.user.create({
    data: { name: 'Customer A', phone: '01711000021', email: 'customera@example.com', role: 'customer', isVerified: true },
  })
  const customerB = await testDb.user.create({
    data: { name: 'Customer B', phone: '01711000022', email: 'customerb@example.com', role: 'customer', isVerified: true },
  })

  const orderB = await testDb.order.create({
    data: {
      orderNumber: `ORD-B-${Date.now()}`,
      userId: customerB.id,
      totalAmount: 320,
      deliveryCharge: 60,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      items: {
        create: [{ productId: product.id, productName: product.name, quantity: 1, unit: 'bottle', price: 320 }],
      },
    },
  })

  const result = await getOrderForUser(orderB.orderNumber, { userId: customerA.id, role: customerA.role }, testDb)
  assert.equal(result.status, 404, 'Customer A attempting to view Customer B order must return 404')
  assert.equal(result.order, null)
})

test('9. Admin can see allowed order details without raw payment secrets', async () => {
  const product = await setupProduct()
  const admin = await testDb.user.create({
    data: { name: 'Admin Staff', phone: '01711000030', email: 'adminstaff@example.com', role: 'admin', isVerified: true },
  })

  const order = await testDb.order.create({
    data: {
      orderNumber: `ORD-ADM-${Date.now()}`,
      guestName: 'Anonymous Guest',
      guestPhone: '01711000031',
      totalAmount: 320,
      deliveryCharge: 60,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      items: {
        create: [{ productId: product.id, productName: product.name, quantity: 1, unit: 'bottle', price: 320 }],
      },
    },
  })

  const result = await getOrderForUser(order.orderNumber, { userId: admin.id, role: admin.role }, testDb)
  assert.equal(result.status, 200)
  assert.ok(result.order)
  // Ensure sensitive columns are excluded
  assert.equal(result.order.rawResponse, undefined)
  assert.equal(result.order.guestAccessTokenHash, undefined)
})

test('10. Registered unverified phone -> checkout blocked until OTP verified', async () => {
  const product = await setupProduct()
  const unverifiedUser = await testDb.user.create({
    data: {
      name: 'Unverified Customer',
      phone: '01711000040',
      email: 'unverified@example.com',
      role: 'customer',
      isVerified: false,
      sessionVersion: 1,
    },
  })

  const address = await testDb.address.create({
    data: {
      userId: unverifiedUser.id,
      name: 'Unverified Customer',
      phone: '01711000040',
      address: 'Test Address Line',
      city: 'Dhaka',
    },
  })

  const token = await generateToken(unverifiedUser.id, unverifiedUser.sessionVersion)

  const req = makeReq(
    'http://localhost:3000/api/orders',
    {
      userId: unverifiedUser.id,
      addressId: address.id,
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'standard',
      paymentMethod: 'cod',
    },
    { Authorization: `Bearer ${token}` }
  )

  const res = await postOrder(req)
  const data = await res.json()

  assert.equal(res.status, 403)
  assert.equal(data.code, 'PHONE_UNVERIFIED')
})

test('11. Online payment option controlled by site setting', async () => {
  await testDb.siteConfig.upsert({
    where: { key: 'enableOnlinePayment' },
    update: { value: 'false' },
    create: { key: 'enableOnlinePayment', value: 'false', type: 'boolean', group: 'payment' },
  })

  const setting = await testDb.siteConfig.findUnique({ where: { key: 'enableOnlinePayment' } })
  assert.equal(setting.value, 'false')

  // When disabled, initiating online payment should return 503
  const product = await setupProduct()
  const phone = '01711000050'
  const proof = createCheckoutProof(phone)

  const orderRes = await postOrder(
    makeReq('http://localhost:3000/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'standard',
      paymentMethod: 'cod',
      guestName: 'Payment Test Guest',
      guestPhone: phone,
      guestAddress: 'Dhaka',
      checkoutProof: proof,
    })
  )
  const orderData = await orderRes.json()
  const orderId = orderData.data.id

  const initReq = makeReq('http://localhost:3000/api/payments/sslcommerz/initiate', {
    orderId,
    guestAccessToken: orderData.guestAccessToken,
  })

  const initRes = await postPaymentInitiate(initReq)
  assert.equal(initRes.status, 503, 'Disabled online payment must return 503')
})

test('12. Missing SSLCommerz config gives safe fallback without secret leaks', async () => {
  // Re-enable setting
  await testDb.siteConfig.upsert({
    where: { key: 'enableOnlinePayment' },
    update: { value: 'true' },
    create: { key: 'enableOnlinePayment', value: 'true', type: 'boolean', group: 'payment' },
  })

  const product = await setupProduct()
  const phone = '01711000055'
  const proof = createCheckoutProof(phone)

  const orderRes = await postOrder(
    makeReq('http://localhost:3000/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'standard',
      paymentMethod: 'cod',
      guestName: 'Gateway Test Guest',
      guestPhone: phone,
      guestAddress: 'Dhaka',
      checkoutProof: proof,
    })
  )
  const orderData = await orderRes.json()
  const orderId = orderData.data.id

  // Temporarily unset SSLCOMMERZ credentials
  const oldStore = process.env.SSLCOMMERZ_STORE_ID
  delete process.env.SSLCOMMERZ_STORE_ID
  await testDb.siteConfig.deleteMany({
    where: { key: { in: ['sslcommerzStoreId', 'sslcommerzStorePassword'] } },
  })

  try {
    const initReq = makeReq('http://localhost:3000/api/payments/sslcommerz/initiate', {
      orderId,
      guestAccessToken: orderData.guestAccessToken,
    })
    const initRes = await postPaymentInitiate(initReq)
    const initJson = await initRes.json()

    assert.equal(initRes.status, 503)
    assert.equal(initJson.error, 'SSLCOMMERZ credentials are not configured')
    assert.equal(initJson.secret, undefined)
  } finally {
    process.env.SSLCOMMERZ_STORE_ID = oldStore
  }
})

test('13. Guest online payment initiation requires valid guest access proof', async () => {
  await testDb.siteConfig.upsert({
    where: { key: 'enableOnlinePayment' },
    update: { value: 'true' },
    create: { key: 'enableOnlinePayment', value: 'true', type: 'boolean', group: 'payment' },
  })

  const product = await setupProduct()
  const phone = '01711000060'
  const proof = createCheckoutProof(phone)

  const orderRes = await postOrder(
    makeReq('http://localhost:3000/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'standard',
      paymentMethod: 'cod',
      guestName: 'Auth Test Guest',
      guestPhone: phone,
      guestAddress: 'Dhaka',
      checkoutProof: proof,
    })
  )
  const orderData = await orderRes.json()
  const orderId = orderData.data.id

  // Call initiate WITHOUT guest access token
  const noTokenReq = makeReq('http://localhost:3000/api/payments/sslcommerz/initiate', {
    orderId,
  })
  const noTokenRes = await postPaymentInitiate(noTokenReq)
  assert.equal(noTokenRes.status, 403, 'Initiate without token must return 403 Forbidden')

  // Call initiate WITH invalid guest access token
  const wrongTokenReq = makeReq('http://localhost:3000/api/payments/sslcommerz/initiate', {
    orderId,
    guestAccessToken: 'wrong-token-abc-123',
  })
  const wrongTokenRes = await postPaymentInitiate(wrongTokenReq)
  assert.equal(wrongTokenRes.status, 403, 'Initiate with invalid token must return 403 Forbidden')
})

test('14. Browser payment callback produces zero sensitive database mutation', async () => {
  const product = await setupProduct()
  const phone = '01711000070'
  const proof = createCheckoutProof(phone)

  const orderRes = await postOrder(
    makeReq('http://localhost:3000/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'standard',
      paymentMethod: 'online',
      guestName: 'Callback Test Guest',
      guestPhone: phone,
      guestAddress: 'Dhaka',
      checkoutProof: proof,
    })
  )
  const orderData = await orderRes.json()
  const orderId = orderData.data.id

  // Simulate a forged browser callback (such as success or cancel redirect)
  const browserCallbackReq = new Request('http://localhost:3000/api/payments/sslcommerz/success', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `tran_id=FORGED_TXN_BROWSER&val_id=VAL_123&value_a=${orderId}`,
  })

  await handleSSLCommerzCallback(browserCallbackReq, 'success', testDb)

  const orderAfter = await testDb.order.findUnique({
    where: { id: orderId },
  })

  assert.equal(orderAfter.orderStatus, 'pending', 'Browser callback must NOT mutate orderStatus')
  assert.equal(orderAfter.paymentStatus, 'pending', 'Browser callback must NOT mutate paymentStatus')
  assert.equal(orderAfter.stockReserved, true, 'Browser callback must NOT touch stockReserved')
})

test('15. SSLCOMMERZ IPN remains authoritative for payment transitions', async () => {
  const product = await setupProduct()
  const phone = '01711000075'
  const proof = createCheckoutProof(phone)

  const orderRes = await postOrder(
    makeReq('http://localhost:3000/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'standard',
      paymentMethod: 'online',
      guestName: 'IPN Test Guest',
      guestPhone: phone,
      guestAddress: 'Dhaka',
      checkoutProof: proof,
    })
  )
  const orderData = await orderRes.json()
  const orderId = orderData.data.id

  const ipnFailRequest = new Request('http://localhost:3000/api/payments/sslcommerz/ipn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `tran_id=KK-${orderData.data.orderNumber}&status=FAILED&value_a=${orderId}`,
  })

  const response = await handleSSLCommerzCallback(ipnFailRequest, 'ipn', testDb)
  assert.equal(response.status, 200, 'IPN must process successfully')

  const orderAfterIpn = await testDb.order.findUnique({
    where: { id: orderId },
  })

  assert.equal(orderAfterIpn.orderStatus, 'cancelled', 'Authoritative IPN failure cancels order')
  assert.equal(orderAfterIpn.paymentStatus, 'failed', 'Authoritative IPN failure marks payment failed')
  assert.equal(orderAfterIpn.stockReserved, false, 'Authoritative IPN failure releases reserved stock')
})

test('16. Registration UI and form contract validation', async () => {
  // 1. Invalid input rejected
  const invalidRes = validateRegistration({
    name: 'A', // too short
    password: '123', // too short
  })
  assert.equal(invalidRes.ok, false, 'Invalid registration payload must be rejected')

  // 2. Valid email registration
  const validEmailRes = validateRegistration({
    name: 'Valid Name',
    email: 'newuser@example.com',
    password: 'securePassword123',
  })
  assert.equal(validEmailRes.ok, true, 'Valid email registration must pass validation')

  // 3. Valid phone registration
  const validPhoneRes = validateRegistration({
    name: 'Valid Phone User',
    phone: '01711000088',
    password: 'securePassword123',
  })
  assert.equal(validPhoneRes.ok, true, 'Valid Bangladeshi phone registration must pass validation')
  assert.equal(validPhoneRes.data.phone, '01711000088')
})

test.after(async () => {
  await testDb.$disconnect()
})
