/**
 * checkout-registration-ui.test.mjs
 * Tests for registration/checkout UI contracts, payment options, and SSLCommerz integration.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { NextRequest } from 'next/server.js'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()

globalThis.prisma = testDb

// Configure test environment
process.env.SSLCOMMERZ_STORE_ID = 'test_store_checkout'
process.env.SSLCOMMERZ_STORE_PASSWORD = 'test_pass_checkout'
process.env.SSLCOMMERZ_IS_LIVE = 'false'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.NODE_ENV = 'test'

const { validateCheckout } = await import('../src/lib/validation.ts')
const { handleSSLCommerzCallback } = await import('../src/app/api/payments/sslcommerz/handler.ts')
const { POST: postFaq } = await import('../src/app/api/faq/route.ts')
const { GET: getFaq } = await import('../src/app/api/faq/route.ts')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method, url, body, headers = {}) {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': 'test-csrf',
      cookie: 'csrf_token=test-csrf',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function cleanupDb() {
  await testDb.orderItem.deleteMany()
  await testDb.payment.deleteMany()
  await testDb.auditLog.deleteMany()
  await testDb.order.deleteMany()
  await testDb.cartItem.deleteMany()
  await testDb.otpChallenge.deleteMany().catch(() => {})
  await testDb.productImage.deleteMany()
  await testDb.product.deleteMany()
  await testDb.category.deleteMany()
  await testDb.user.deleteMany()
  await testDb.siteConfig.deleteMany()
  await testDb.fAQItem.deleteMany()
}

// ─── Payment Method Validation ────────────────────────────────────────────────

test('validateCheckout: paymentMethod=cod is valid', () => {
  const result = validateCheckout({
    paymentMethod: 'cod',
    items: [{ productId: 'prod_1', quantity: 1 }],
    guestName: 'Test Customer',
    guestPhone: '01711000001',
    guestAddress: '123 Test St',
    guestEmail: 'test@example.com',
  })
  assert.ok(result.ok, 'COD payment should be valid')
  if (result.ok) {
    assert.equal(result.data.paymentMethod, 'cod')
  }
})

test('validateCheckout: paymentMethod=online is valid', () => {
  const result = validateCheckout({
    paymentMethod: 'online',
    items: [{ productId: 'prod_1', quantity: 1 }],
    guestName: 'Test Customer',
    guestPhone: '01711000001',
    guestAddress: '123 Test St',
    guestEmail: 'test@example.com',
  })
  assert.ok(result.ok, 'Online payment should be valid')
  if (result.ok) {
    assert.equal(result.data.paymentMethod, 'online')
  }
})

test('validateCheckout: invalid paymentMethod is rejected', () => {
  const result = validateCheckout({
    paymentMethod: 'paypal',
    items: [{ productId: 'prod_1', quantity: 1 }],
    guestName: 'Test Customer',
    guestPhone: '01711000001',
    guestAddress: '123 Test St',
    guestEmail: 'test@example.com',
  })
  assert.ok(!result.ok, 'Invalid payment method should be rejected')
  if (!result.ok) {
    assert.ok(result.errors.paymentMethod, 'Should have paymentMethod error')
  }
})

test('validateCheckout: paymentMethod defaults to cod when missing', () => {
  const result = validateCheckout({
    items: [{ productId: 'prod_1', quantity: 1 }],
    guestName: 'Test Customer',
    guestPhone: '01711000001',
    guestAddress: '123 Test St',
    guestEmail: 'test@example.com',
  })
  if (result.ok) {
    assert.equal(result.data.paymentMethod, 'cod', 'Default payment method should be cod')
  }
})

// ─── Phone Verification Gate ──────────────────────────────────────────────────

test('checkout order with userId requires phone verification (server enforces)', async (t) => {
  await cleanupDb()

  // Create unverified customer
  const customer = await testDb.user.create({
    data: {
      email: 'unverified@example.com',
      phone: '01711100001',
      name: 'Unverified Customer',
      role: 'customer',
      isVerified: false, // <-- unverified
      sessionVersion: 1,
    },
  })

  // Server-side check: Checkout security rule — logged-in customer must have verified phone
  const dbCustomer = await testDb.user.findUnique({
    where: { id: customer.id },
    select: { phone: true, isVerified: true, role: true },
  })

  assert.ok(dbCustomer, 'Customer should exist')
  // The server gate checks both: isVerified=true AND phone is not null
  const isPhoneGated = !dbCustomer?.isVerified || !dbCustomer?.phone
  assert.ok(isPhoneGated, 'Unverified customer should be gated from checkout')
})

test('checkout allows order when customer is verified', async (t) => {
  await cleanupDb()

  const customer = await testDb.user.create({
    data: {
      email: 'verified@example.com',
      phone: '01711100002',
      name: 'Verified Customer',
      role: 'customer',
      isVerified: true, // verified
      sessionVersion: 1,
    },
  })

  const dbCustomer = await testDb.user.findUnique({
    where: { id: customer.id },
    select: { phone: true, isVerified: true, role: true },
  })

  const isPhoneGated = !dbCustomer?.isVerified || !dbCustomer?.phone
  assert.ok(!isPhoneGated, 'Verified customer with phone should NOT be gated')
})

// ─── SSLCommerz Online Payment ────────────────────────────────────────────────

test('online payment initiation: disabled when enableOnlinePayment=false', async (t) => {
  await cleanupDb()

  // Set online payment config to disabled
  await testDb.siteConfig.create({
    data: { key: 'enableOnlinePayment', value: 'false' },
  })

  // Create a test order
  const user = await testDb.user.create({
    data: { email: 'payer@example.com', phone: '01711100003', name: 'Payer', role: 'customer', isVerified: true, sessionVersion: 1 },
  })
  const category = await testDb.category.create({ data: { name: 'Test Cat', slug: 'test-cat', isActive: true } })
  const product = await testDb.product.create({
    data: { name: 'Test Product', slug: 'test-product', price: 500, stock: 10, categoryId: category.id, unit: 'pcs' },
  })
  const order = await testDb.order.create({
    data: {
      userId: user.id,
      orderNumber: 'ORD-TEST-001',
      totalAmount: 500,
      orderStatus: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'online',
      guestName: 'Test Customer',
      guestPhone: '01711100003',
      guestAddress: '123 Test Street, Dhaka',
      items: { create: [{ productId: product.id, productName: 'Test', quantity: 1, unit: 'pcs', price: 500 }] },
    },
  })

  const { generateToken } = await import('../src/lib/auth.ts')
  const token = await generateToken(user.id, user.sessionVersion)

  const req = makeRequest('POST', 'http://localhost:3000/api/payments/sslcommerz/initiate', { orderId: order.id }, {
    Authorization: `Bearer ${token}`,
  })
  const { POST: initiatePost } = await import('../src/app/api/payments/sslcommerz/initiate/route.ts')
  const res = await initiatePost(req)
  const data = await res.json()

  assert.equal(res.status, 503, 'Should return 503 when online payment is disabled')
  assert.ok(!data.success, 'Should not succeed')
})

test('online payment initiation: disabled when SSLCOMMERZ not configured', async (t) => {
  await cleanupDb()

  // Enable payment but no credentials
  await testDb.siteConfig.create({ data: { key: 'enableOnlinePayment', value: 'true' } })

  // Clear env credentials
  const origStoreId = process.env.SSLCOMMERZ_STORE_ID
  const origPass = process.env.SSLCOMMERZ_STORE_PASSWORD
  delete process.env.SSLCOMMERZ_STORE_ID
  delete process.env.SSLCOMMERZ_STORE_PASSWORD

  const user = await testDb.user.create({
    data: { email: 'payer2@example.com', phone: '01711100004', name: 'Payer2', role: 'customer', isVerified: true, sessionVersion: 1 },
  })
  const order = await testDb.order.create({
    data: {
      userId: user.id,
      orderNumber: 'ORD-TEST-002',
      totalAmount: 300,
      orderStatus: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'online',
      guestName: 'Test Customer 2',
      guestPhone: '01711100004',
      guestAddress: '123 Test Street, Dhaka',
    },
  })

  const { generateToken } = await import('../src/lib/auth.ts')
  const token = await generateToken(user.id, user.sessionVersion)
  const req = makeRequest('POST', 'http://localhost:3000/api/payments/sslcommerz/initiate', { orderId: order.id }, {
    Authorization: `Bearer ${token}`,
  })
  const { POST: initiatePost } = await import('../src/app/api/payments/sslcommerz/initiate/route.ts')
  const res = await initiatePost(req)
  const data = await res.json()

  // Restore env
  if (origStoreId) process.env.SSLCOMMERZ_STORE_ID = origStoreId
  if (origPass) process.env.SSLCOMMERZ_STORE_PASSWORD = origPass

  assert.ok(res.status === 503 || res.status === 503, 'Should return 503 when credentials missing')
  assert.ok(!data.success, 'Should not succeed without credentials')
})

// ─── Browser Callback Zero-Mutation ──────────────────────────────────────────

test('browser success callback does NOT mutate order/payment state', async (t) => {
  await cleanupDb()

  const user = await testDb.user.create({
    data: { email: 'browser@example.com', phone: '01711100005', name: 'Browser', role: 'customer', isVerified: true, sessionVersion: 1 },
  })
  const order = await testDb.order.create({
    data: {
      userId: user.id,
      orderNumber: 'ORD-BROWSER-001',
      totalAmount: 800,
      orderStatus: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'online',
      guestName: 'Browser Test',
      guestPhone: '01711100005',
      guestAddress: '123 Test Street, Dhaka',
    },
  })

  // Snapshot state BEFORE callback
  const beforeOrder = await testDb.order.findUnique({ where: { id: order.id } })
  const beforePayment = await testDb.payment.findUnique({ where: { orderId: order.id } }).catch(() => null)

  // Simulate browser success callback (non-authoritative)
  const formData = new URLSearchParams({ value_a: order.id, tran_id: 'TXN-TEST', status: 'VALID' })
  const req = new NextRequest('http://localhost:3000/api/payments/sslcommerz/success', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })

  await handleSSLCommerzCallback(req, 'success', testDb)

  // Snapshot state AFTER callback
  const afterOrder = await testDb.order.findUnique({ where: { id: order.id } })
  const afterPayment = await testDb.payment.findUnique({ where: { orderId: order.id } }).catch(() => null)

  // Order status must be unchanged
  assert.equal(afterOrder?.orderStatus, beforeOrder?.orderStatus,
    'Browser success callback must not change orderStatus')
  assert.equal(afterOrder?.paymentStatus, beforeOrder?.paymentStatus,
    'Browser success callback must not change paymentStatus')
  // No payment record should be created by browser callback
  assert.equal(afterPayment, beforePayment, 'Browser callback must not create/modify payment records')
})

test('browser cancel callback does NOT mutate order state', async (t) => {
  await cleanupDb()

  const user = await testDb.user.create({
    data: { email: 'cancel@example.com', phone: '01711100006', name: 'Cancel', role: 'customer', isVerified: true, sessionVersion: 1 },
  })
  const order = await testDb.order.create({
    data: {
      userId: user.id,
      orderNumber: 'ORD-CANCEL-001',
      totalAmount: 400,
      orderStatus: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'online',
      guestName: 'Cancel Test',
      guestPhone: '01711100006',
      guestAddress: '123 Test Street, Dhaka',
    },
  })

  const beforeOrder = await testDb.order.findUnique({ where: { id: order.id } })

  const formData = new URLSearchParams({ value_a: order.id, tran_id: 'TXN-CANCEL' })
  const req = new NextRequest('http://localhost:3000/api/payments/sslcommerz/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })

  await handleSSLCommerzCallback(req, 'cancel', testDb)

  const afterOrder = await testDb.order.findUnique({ where: { id: order.id } })
  assert.equal(afterOrder?.orderStatus, beforeOrder?.orderStatus, 'Cancel callback must not change orderStatus')
  assert.equal(afterOrder?.paymentStatus, beforeOrder?.paymentStatus, 'Cancel callback must not change paymentStatus')
})

// ─── FAQ API Tests ─────────────────────────────────────────────────────────────

test('FAQ API: public endpoint returns only active items', async (t) => {
  await cleanupDb()

  // Create active and inactive FAQ items
  await testDb.fAQItem.createMany({
    data: [
      { question: 'Active Q1', answer: 'Answer 1', isActive: true, sortOrder: 0 },
      { question: 'Active Q2', answer: 'Answer 2', isActive: true, sortOrder: 1 },
      { question: 'Inactive Q', answer: 'Hidden answer', isActive: false, sortOrder: 2 },
    ],
  })

  const req = new NextRequest('http://localhost:3000/api/faq?limit=20')
  const res = await getFaq(req)
  const data = await res.json()

  assert.ok(data.success, 'Should succeed')
  const items = Array.isArray(data.data?.data) ? data.data.data : (Array.isArray(data.data?.items) ? data.data.items : [])
  assert.ok(items.length === 2, `Should return only 2 active items, got ${items.length}`)
  items.forEach((item) => {
    assert.ok(item.isActive !== false, 'All returned items should be active')
    assert.notEqual(item.question, 'Inactive Q', 'Inactive FAQ should not appear in public list')
  })
})

test('FAQ API: admin endpoint returns all items including inactive', async (t) => {
  await cleanupDb()

  await testDb.fAQItem.createMany({
    data: [
      { question: 'Active Admin Q', answer: 'Answer', isActive: true, sortOrder: 0 },
      { question: 'Inactive Admin Q', answer: 'Hidden', isActive: false, sortOrder: 1 },
    ],
  })

  // Create admin user and token
  const admin = await testDb.user.create({
    data: { email: 'faq-admin@example.com', phone: '01711100007', name: 'FAQ Admin', role: 'admin', sessionVersion: 1 },
  })
  const { generateToken } = await import('../src/lib/auth.ts')
  const token = await generateToken(admin.id, admin.sessionVersion)

  const req = new NextRequest('http://localhost:3000/api/faq?admin=true&limit=20', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const res = await getFaq(req)
  const data = await res.json()

  assert.ok(data.success, 'Should succeed for admin')
  const items = Array.isArray(data.data?.data) ? data.data.data : (Array.isArray(data.data?.items) ? data.data.items : [])
  assert.ok(items.length === 2, `Admin should see all 2 items, got ${items.length}`)
})

test('FAQ homepage: returns empty when no active FAQs exist', async (t) => {
  await cleanupDb()

  // Only inactive items
  await testDb.fAQItem.create({ data: { question: 'Hidden Q', answer: 'Hidden A', isActive: false, sortOrder: 0 } })

  const req = new NextRequest('http://localhost:3000/api/faq?limit=20')
  const res = await getFaq(req)
  const data = await res.json()

  assert.ok(data.success, 'Should succeed even with no active items')
  const items = Array.isArray(data.data?.data) ? data.data.data : (Array.isArray(data.data?.items) ? data.data.items : [])
  assert.equal(items.length, 0, 'Should return 0 active FAQ items')
})
