import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { NextRequest } from 'next/server.js'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()

globalThis.prisma = testDb

// Test Environment setup
process.env.NODE_ENV = 'test'
process.env.APP_SECRET = 'test-secret-key-at-least-32-chars-long-for-hmac'
process.env.NEXTAUTH_SECRET = 'test-secret-key-at-least-32-chars-long-for-hmac'
process.env.OTP_SECRET = 'test-secret-at-least-32-characters-long'
process.env.BULKSMSBD_API_KEY = 'mock-test-key'
process.env.BULKSMSBD_SENDER_ID = 'KHATI_KHADYO'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

const { setBulkSmsMockTransport } = await import('../src/lib/bulksmsbd.ts')
setBulkSmsMockTransport(async () => ({ success: true, messageId: 'mock-msg' }))

const { POST: postOrder } = await import('../src/app/api/orders/route.ts')
const { generateToken, hashPassword } = await import('../src/lib/auth.ts')
const { createCheckoutProof } = await import('../src/lib/checkout-proof.ts')
const { packSmartAddress } = await import('../src/lib/bangladesh-address.ts')

// Helper for making NextRequest
function makeReq(url, body = null, token = null, headers = {}) {
  const reqHeaders = new Headers({
    'Content-Type': 'application/json',
    'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
    ...headers,
  })
  if (token) {
    reqHeaders.set('cookie', `auth_token=${token}`)
    reqHeaders.set('authorization', `Bearer ${token}`)
  }
  return new NextRequest(url, {
    method: body ? 'POST' : 'GET',
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : null,
  })
}

function randomPhone() {
  return '017' + Math.floor(10000000 + Math.random() * 90000000)
}

async function createTestProduct(name = 'Organic Mustard Oil 1L', price = 450, stock = 25) {
  let category = await testDb.category.findFirst({ where: { slug: 'organic-oils' } })
  if (!category) {
    category = await testDb.category.create({
      data: { name: 'Organic Oils', slug: 'organic-oils', isActive: true },
    })
  }

  return testDb.product.create({
    data: {
      name,
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      price,
      stock,
      unit: '1L',
      status: 'active',
      categoryId: category.id,
      images: {
        create: [{ url: 'https://res.cloudinary.com/demo/image/upload/oil.jpg', isFeatured: true }],
      },
    },
    include: { images: true },
  })
}

test('1. Logged-in verified customer with saved address -> COD order succeeds (HTTP 201)', async () => {
  const phone = randomPhone()
  const customer = await testDb.user.create({
    data: {
      name: 'Tamim Iqbal',
      email: `tamim-${Date.now()}@test.local`,
      phone,
      password: await hashPassword('SecurePass123!'),
      role: 'customer',
      isVerified: true,
    },
  })
  const token = await generateToken(customer.id, customer.sessionVersion)

  const address = await testDb.address.create({
    data: {
      userId: customer.id,
      name: 'Tamim Iqbal Home',
      phone,
      address: 'House 42, Road 11, Banani',
      city: 'Dhaka',
      district: 'Dhaka',
      postalCode: '1213',
      isDefault: true,
    },
  })

  const product = await createTestProduct('Pure Mustard Oil', 500, 20)

  const req = makeReq(
    'http://localhost:3000/api/orders',
    {
      userId: customer.id,
      addressId: address.id,
      items: [{ productId: product.id, quantity: 2 }],
      paymentMethod: 'cod',
      shippingMethod: 'standard',
    },
    token
  )

  const res = await postOrder(req)
  const json = await res.json()

  assert.equal(res.status, 201, `Expected HTTP 201, got ${res.status}: ${JSON.stringify(json)}`)
  assert.equal(json.success, true)
  assert.ok(json.data.orderNumber)
  assert.equal(json.data.userId, customer.id)
  assert.equal(json.data.paymentMethod, 'cod')
  assert.equal(json.data.paymentStatus, 'pending')

  // Verify DeliveryLabel was created with non-null strings
  const label = await testDb.deliveryLabel.findUnique({
    where: { orderId: json.data.id },
  })
  assert.ok(label, 'Delivery label must be created')
  assert.equal(label.customerName, 'Tamim Iqbal Home')
  assert.equal(label.phone, phone)
  assert.ok(label.address.includes('Banani'))
  assert.ok(label.productSummary.includes('Pure Mustard Oil'))

  // Verify OrderStatusHistory
  const history = await testDb.orderStatusHistory.findFirst({
    where: { orderId: json.data.id },
  })
  assert.ok(history, 'Order status history must be created')
  assert.equal(history.status, 'pending')
  assert.equal(history.changedBy, customer.id)
})

test('2. Logged-in customer with Smart BD Address -> clean address stored without meta corruption', async () => {
  const phone = randomPhone()
  const customer = await testDb.user.create({
    data: {
      name: 'Smart Address User',
      email: `smart-${Date.now()}@test.local`,
      phone,
      password: await hashPassword('SecurePass123!'),
      role: 'customer',
      isVerified: true,
    },
  })
  const token = await generateToken(customer.id, customer.sessionVersion)

  const packed = packSmartAddress({
    name: 'Smart Recipient',
    phone,
    division: 'Dhaka',
    district: 'Dhaka',
    upazila: 'Dhanmondi',
    postalCode: '1205',
    addressDetail: 'Flat 4B, House 12, Road 4',
    landmark: 'Opposite to Dhanmondi Lake',
    label: 'Home',
  })

  const address = await testDb.address.create({
    data: {
      userId: customer.id,
      name: packed.name,
      phone: packed.phone,
      address: packed.address,
      city: packed.city,
      district: packed.district,
      postalCode: packed.postalCode,
      isDefault: true,
    },
  })

  const product = await createTestProduct('Organic Ghee 500g', 850, 15)

  const req = makeReq(
    'http://localhost:3000/api/orders',
    {
      userId: customer.id,
      addressId: address.id,
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: 'cod',
      shippingMethod: 'standard',
    },
    token
  )

  const res = await postOrder(req)
  const json = await res.json()

  assert.equal(res.status, 201)
  const createdOrder = await testDb.order.findUnique({
    where: { id: json.data.id },
  })
  assert.ok(createdOrder.guestAddress.includes('Flat 4B, House 12, Road 4'))
  assert.ok(createdOrder.guestAddress.includes('__BDMETA__'))
  // Ensure the address does not end with corrupted ", undefined"
  assert.ok(!createdOrder.guestAddress.endsWith(', undefined'))
})

test('3. Guest checkout with valid OTP checkoutProof and packed BD address -> succeeds with 201', async () => {
  const phone = randomPhone()
  const proof = createCheckoutProof(phone)
  const product = await createTestProduct('Wild Honey 500g', 750, 10)

  const packedGuestAddress = packSmartAddress({
    name: 'Guest Shopper',
    phone,
    division: 'Chattogram',
    district: 'Chattogram',
    upazila: 'Panchlaish',
    postalCode: '4203',
    addressDetail: 'House 5, Road 2, Nasirabad',
    label: 'Home',
  })

  const req = makeReq('http://localhost:3000/api/orders', {
    items: [{ productId: product.id, quantity: 1 }],
    shippingMethod: 'standard',
    paymentMethod: 'cod',
    guestName: 'Guest Shopper',
    guestPhone: phone,
    guestAddress: packedGuestAddress.address,
    checkoutProof: proof,
  })

  const res = await postOrder(req)
  const json = await res.json()

  assert.equal(res.status, 201, `Guest order should succeed with 201: ${JSON.stringify(json)}`)
  assert.ok(json.data.orderNumber)
  assert.ok(json.guestAccessToken, 'Must return raw guest token')

  // Verify guest user identity creation
  const createdUser = await testDb.user.findFirst({ where: { phone } })
  assert.ok(createdUser, 'Guest customer profile must be created')
  assert.equal(createdUser.isVerified, true)
  assert.equal(createdUser.password, null)
  assert.equal(json.data.userId, createdUser.id)

  // Verify delivery label
  const label = await testDb.deliveryLabel.findUnique({ where: { orderId: json.data.id } })
  assert.ok(label)
  assert.equal(label.customerName, 'Guest Shopper')
  assert.equal(label.phone, phone)
})

test('4. Insufficient stock inside transaction -> returns HTTP 400 (not 500!) with INSUFFICIENT_STOCK', async () => {
  const phone = randomPhone()
  const proof = createCheckoutProof(phone)
  // Create product with only 2 items in stock
  const product = await createTestProduct('Rare Forest Honey', 1200, 2)

  // Attempt to purchase 3 items
  const req = makeReq('http://localhost:3000/api/orders', {
    items: [{ productId: product.id, quantity: 3 }],
    shippingMethod: 'standard',
    paymentMethod: 'cod',
    guestName: 'Stock Tester',
    guestPhone: phone,
    guestAddress: 'Dhanmondi, Dhaka',
    checkoutProof: proof,
  })

  const res = await postOrder(req)
  const json = await res.json()

  assert.equal(res.status, 400, `Expected 400 for insufficient stock, got ${res.status}`)
  assert.equal(json.success, false)
  assert.ok(json.error.includes('পর্যাপ্ত স্টক নেই') || json.error.includes('Insufficient stock'))

  // Verify stock was NOT deducted
  const checkProduct = await testDb.product.findUnique({ where: { id: product.id } })
  assert.equal(checkProduct.stock, 2)
})

test('5. Duplicate guest phone order -> succeeds with 201 and reuses existing profile (no P2002 500 crash)', async () => {
  const phone = randomPhone()
  const proof1 = createCheckoutProof(phone)
  const proof2 = createCheckoutProof(phone)
  const product = await createTestProduct('Black Seed Oil', 350, 50)

  // Order 1
  const res1 = await postOrder(
    makeReq('http://localhost:3000/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'standard',
      paymentMethod: 'cod',
      guestName: 'First Order Guest',
      guestPhone: phone,
      guestAddress: 'Uttara, Dhaka',
      checkoutProof: proof1,
    })
  )
  assert.equal(res1.status, 201)
  const json1 = await res1.json()

  // Order 2 with identical phone
  const res2 = await postOrder(
    makeReq('http://localhost:3000/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'standard',
      paymentMethod: 'cod',
      guestName: 'Second Order Guest',
      guestPhone: phone,
      guestAddress: 'Uttara, Dhaka',
      checkoutProof: proof2,
    })
  )
  const json2 = await res2.json()
  assert.equal(res2.status, 201, `Second order with same phone must succeed with 201: ${JSON.stringify(json2)}`)

  // Both orders should link to the same user profile
  assert.equal(json1.data.userId, json2.data.userId)
})

test('6. Guest checkout without valid checkoutProof -> rejected with 403 PHONE_UNVERIFIED', async () => {
  const product = await createTestProduct('Chia Seeds', 400, 10)
  const phone = randomPhone()

  const req = makeReq('http://localhost:3000/api/orders', {
    items: [{ productId: product.id, quantity: 1 }],
    shippingMethod: 'standard',
    paymentMethod: 'cod',
    guestName: 'Unverified Guest',
    guestPhone: phone,
    guestAddress: 'Mirpur, Dhaka',
    checkoutProof: null, // missing checkout proof
  })

  const res = await postOrder(req)
  const json = await res.json()

  assert.equal(res.status, 403)
  assert.equal(json.code, 'PHONE_UNVERIFIED')
})

test('7. Missing or invalid user account for userId -> returns 401/404 (not foreign key 500 error)', async () => {
  const product = await createTestProduct('Organic Dal', 200, 10)
  const fakeUserId = 'cuid_non_existent_user_99999'

  // Generate a valid token format for non-existent user
  const token = await generateToken(fakeUserId, 0)

  const req = makeReq(
    'http://localhost:3000/api/orders',
    {
      userId: fakeUserId,
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: 'cod',
      shippingMethod: 'standard',
      guestName: 'Ghost Customer',
      guestPhone: '01711223344',
      guestAddress: 'Dhaka',
    },
    token
  )

  const res = await postOrder(req)
  const json = await res.json()

  assert.ok(
    res.status === 401 || res.status === 404,
    `Expected 401 or 404 for non-existent user, got ${res.status}: ${JSON.stringify(json)}`
  )
  assert.equal(json.success, false)
})
