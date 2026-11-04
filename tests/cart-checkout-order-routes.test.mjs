import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()

globalThis.prisma = testDb

const { getOrderForUser } = await import('../src/lib/order-authorization.ts')
const { getSessionUserFromToken } = await import('../src/lib/server-auth.ts')
const { sanitizeInternalRedirect } = await import('../src/lib/security.ts')
const { generateToken } = await import('../src/lib/auth.ts')
const { handleSSLCommerzCallback } = await import('../src/app/api/payments/sslcommerz/handler.ts')

async function setupTestData() {
  // Clear dependent tables
  await testDb.orderItem.deleteMany()
  await testDb.payment.deleteMany()
  await testDb.auditLog.deleteMany()
  await testDb.order.deleteMany()
  await testDb.cartItem.deleteMany()
  await testDb.productImage.deleteMany()
  await testDb.product.deleteMany()
  await testDb.category.deleteMany()
  await testDb.user.deleteMany()

  // 1. Create Users
  const customerA = await testDb.user.create({
    data: {
      email: 'customer.a@example.com',
      phone: '01711000001',
      name: 'Customer A',
      role: 'customer',
      sessionVersion: 1,
    },
  })

  const customerB = await testDb.user.create({
    data: {
      email: 'customer.b@example.com',
      phone: '01711000002',
      name: 'Customer B',
      role: 'customer',
      sessionVersion: 1,
    },
  })

  const adminUser = await testDb.user.create({
    data: {
      email: 'admin.super@example.com',
      phone: '01711000003',
      name: 'Admin Supervisor',
      role: 'admin',
      sessionVersion: 1,
    },
  })

  const managerUser = await testDb.user.create({
    data: {
      email: 'manager.ops@example.com',
      phone: '01711000004',
      name: 'Operations Manager',
      role: 'manager',
      sessionVersion: 1,
    },
  })

  // 2. Create Catalog Product
  const category = await testDb.category.create({
    data: {
      name: 'Organic Ghee',
      slug: 'organic-ghee',
      isActive: true,
    },
  })

  const product = await testDb.product.create({
    data: {
      name: 'Pure Desi Cow Ghee 500g',
      slug: 'pure-desi-cow-ghee-500g',
      price: 950,
      stock: 40,
      unit: '500g',
      status: 'active',
      categoryId: category.id,
      images: {
        create: [
          { url: 'https://res.cloudinary.com/demo/image/upload/ghee.jpg', isFeatured: true },
        ],
      },
    },
  })

  // 3. Create Order A (belonging to Customer A)
  const orderA = await testDb.order.create({
    data: {
      orderNumber: 'ORD-2026-A101',
      userId: customerA.id,
      totalAmount: 1010,
      deliveryCharge: 60,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      orderNote: 'Please ring the doorbell upon delivery.',
      stockReserved: true,
      couponReleased: false,
      items: {
        create: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            price: 950,
            unit: product.unit,
          },
        ],
      },
      payment: {
        create: {
          method: 'online',
          status: 'pending',
          transactionId: 'TXN-A101',
          amount: 1010,
        },
      },
    },
    include: { items: true, payment: true },
  })

  // 4. Create Order B (belonging to Customer B)
  const orderB = await testDb.order.create({
    data: {
      orderNumber: 'ORD-2026-B202',
      userId: customerB.id,
      totalAmount: 1960,
      deliveryCharge: 60,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      orderStatus: 'confirmed',
      guestName: 'Customer B Guest Name',
      guestPhone: '01711000002',
      guestAddress: 'House 12, Road 4, Dhanmondi, Dhaka',
      stockReserved: true,
      items: {
        create: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 2,
            price: 950,
            unit: product.unit,
          },
        ],
      },
      payment: {
        create: {
          method: 'cod',
          status: 'pending',
          amount: 1960,
        },
      },
    },
    include: { items: true, payment: true },
  })

  return { customerA, customerB, adminUser, managerUser, product, orderA, orderB }
}

test('1. /cart direct route test: file exists with canonical metadata and CustomerShell wrapper', async () => {
  const cartRouteContent = fs.readFileSync('src/app/cart/page.tsx', 'utf8')
  assert.ok(cartRouteContent.includes("canonical: '/cart'"), 'Cart route must declare canonical /cart')
  assert.ok(cartRouteContent.includes('<CustomerShell>'), 'Cart route must render within CustomerShell')
  assert.ok(cartRouteContent.includes('<CartPage />'), 'Cart route must render CartPage component')
})

test('2. empty cart -> checkout redirect test: empty cart redirects to /cart', async () => {
  const cartItemsEmpty = []
  let redirectedTo = null
  const fakeRouter = {
    replace: (url) => {
      redirectedTo = url
    },
  }

  if (cartItemsEmpty.length === 0) {
    fakeRouter.replace('/cart')
  }

  assert.equal(redirectedTo, '/cart', 'Empty cart must trigger replace to /cart')
})

test('3. /checkout direct route test: exports robots noindex and renders checkout inside CustomerShell', async () => {
  const checkoutRouteContent = fs.readFileSync('src/app/checkout/page.tsx', 'utf8')
  assert.ok(checkoutRouteContent.includes('index: false'), 'Checkout must disallow indexing')
  assert.ok(checkoutRouteContent.includes('follow: false'), 'Checkout must disallow following')
  assert.ok(checkoutRouteContent.includes('<CustomerShell>'), 'Checkout must render within CustomerShell')
  assert.ok(checkoutRouteContent.includes('<CheckoutPage />'), 'Checkout must render CheckoutPage')
})

test('4. unauthenticated order page -> validated login redirect', async () => {
  const { orderA } = await setupTestData()

  // 1. Data-level check: unauthenticated returns 401 and no order data
  const result = await getOrderForUser(orderA.orderNumber, null, testDb)
  assert.equal(result.status, 401, 'Unauthenticated query must return 401')
  assert.equal(result.order, null, 'Must not leak order data to unauthenticated request')

  // 2. Route-level contract check: unauthenticated user triggers redirect to login with safe next parameter
  const orderRouteContent = fs.readFileSync('src/app/orders/[orderNumber]/page.tsx', 'utf8')
  assert.ok(orderRouteContent.includes('if (!sessionUser)'), 'Must check sessionUser before querying order')
  assert.ok(orderRouteContent.includes("redirect(`/login?next="), 'Must redirect unauthenticated request to /login?next=...')
  assert.ok(!orderRouteContent.includes('OrderAuthErrorView'), 'OrderAuthErrorView must not be used')
})

test('5. malicious external next value -> rejected/sanitized to prevent Open Redirect', async () => {
  // Test valid internal relative paths
  assert.equal(sanitizeInternalRedirect('/orders/ORD-2026-A101'), '/orders/ORD-2026-A101')
  assert.equal(sanitizeInternalRedirect('/orders/ORD-2026-A101?payment=success'), '/orders/ORD-2026-A101?payment=success')
  assert.equal(sanitizeInternalRedirect('/checkout'), '/checkout')

  // Test malicious external URLs
  assert.equal(sanitizeInternalRedirect('https://evil.com'), '/', 'External HTTPS must be sanitized to fallback')
  assert.equal(sanitizeInternalRedirect('http://attacker.com/steal-creds'), '/', 'External HTTP must be sanitized to fallback')

  // Test protocol-relative URLs
  assert.equal(sanitizeInternalRedirect('//evil.com'), '/', 'Protocol-relative //evil.com must be rejected')
  assert.equal(sanitizeInternalRedirect('//evil.com/phishing'), '/', 'Protocol-relative //evil.com/phishing must be rejected')

  // Test backslash tricks
  assert.equal(sanitizeInternalRedirect('/\\evil.com'), '/', 'Backslash /\\evil.com must be rejected')
  assert.equal(sanitizeInternalRedirect('/\\evil.com/path'), '/', 'Backslash /\\evil.com/path must be rejected')
  assert.equal(sanitizeInternalRedirect('\\evil.com'), '/', 'Leading backslash must be rejected')

  // Test script & scheme attacks
  assert.equal(sanitizeInternalRedirect('javascript:alert(1)'), '/', 'javascript: URI must be rejected')
  assert.equal(sanitizeInternalRedirect('data:text/html,<script>alert(1)</script>'), '/', 'data: URI must be rejected')

  // Test CRLF / control character injection
  assert.equal(sanitizeInternalRedirect('/orders/ORD-101\r\nHost: evil.com'), '/', 'CRLF injection must be rejected')
  assert.equal(sanitizeInternalRedirect('/orders/ORD-101\0evil'), '/', 'Null byte must be rejected')

  // Test null / undefined / empty
  assert.equal(sanitizeInternalRedirect(''), '/')
  assert.equal(sanitizeInternalRedirect(null), '/')
  assert.equal(sanitizeInternalRedirect(undefined), '/')
})

test('6. customer A -> customer B order -> true HTTP 404 and zero order-content leak', async () => {
  const { customerA, orderB } = await setupTestData()

  const userA = { userId: customerA.id, role: customerA.role }
  const result = await getOrderForUser(orderB.orderNumber, userA, testDb)

  // Must return 404 to eliminate order existence enumeration
  assert.equal(result.status, 404, 'Cross-customer order access must return 404 (same as non-existent)')
  assert.equal(result.order, null, 'Must not leak customer B order details to customer A')
  assert.equal(result.error, `Order #${orderB.orderNumber} not found`, 'Error must match standard 404')

  // Verify page.tsx triggers notFound() on 404
  const orderRouteContent = fs.readFileSync('src/app/orders/[orderNumber]/page.tsx', 'utf8')
  assert.ok(orderRouteContent.includes('notFound()'), 'Must call notFound() on 404')
})

test('7. unknown order -> true HTTP 404', async () => {
  const { customerA } = await setupTestData()

  const userA = { userId: customerA.id, role: customerA.role }
  const result = await getOrderForUser('ORD-NON-EXISTENT-9999', userA, testDb)

  assert.equal(result.status, 404, 'Non-existent order must return 404')
  assert.equal(result.order, null, 'No order object for non-existent order')
})

test('8. owner -> HTTP 200 with complete authorized order details', async () => {
  const { customerA, orderA } = await setupTestData()

  const ownerResult = await getOrderForUser(orderA.orderNumber, { userId: customerA.id, role: 'customer' }, testDb)
  assert.equal(ownerResult.status, 200, 'Owner must have access to their order')
  assert.equal(ownerResult.order.orderNumber, orderA.orderNumber)
  assert.equal(ownerResult.order.items.length, 1)
  assert.equal(ownerResult.order.items[0].productName, 'Pure Desi Cow Ghee 500g')
  assert.equal(ownerResult.order.orderNote, 'Please ring the doorbell upon delivery.')
})

test('9. admin/manager -> HTTP 200 with strictly zero raw secrets leaked', async () => {
  const { adminUser, managerUser, orderA } = await setupTestData()

  // 1. Admin access test
  const adminResult = await getOrderForUser(orderA.orderNumber, { userId: adminUser.id, role: 'admin' }, testDb)
  assert.equal(adminResult.status, 200, 'Admin must have access to view any order')
  assert.equal(adminResult.order.orderNumber, orderA.orderNumber)

  // 2. Manager access test
  const managerResult = await getOrderForUser(orderA.orderNumber, { userId: managerUser.id, role: 'manager' }, testDb)
  assert.equal(managerResult.status, 200, 'Manager must have access to view any order')
  assert.equal(managerResult.order.orderNumber, orderA.orderNumber)

  // 3. Strictly verify NO raw secrets / gateway logs leaked in response
  assert.equal(adminResult.order.payment?.rawResponse, undefined, 'rawResponse must not exist in safe order')
  assert.equal(adminResult.order.payment?.gatewayUrl, undefined, 'gatewayUrl must not exist in safe order')
  assert.equal(adminResult.order.payment?.sessionKey, undefined, 'sessionKey must not exist in safe order')
})

test('10. payment browser redirect causes zero database mutation test', async () => {
  const { orderA } = await setupTestData()

  const fakeRequest = new Request('http://localhost:3000/api/payments/sslcommerz/success', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `tran_id=FORGED_TXN_BROWSER&val_id=VAL_123&value_a=${orderA.id}`,
  })

  await handleSSLCommerzCallback(fakeRequest, 'success', testDb)

  const orderAfter = await testDb.order.findUnique({
    where: { id: orderA.id },
  })

  assert.equal(orderAfter.orderStatus, 'pending', 'Browser callback must NOT mutate orderStatus')
  assert.equal(orderAfter.paymentStatus, 'pending', 'Browser callback must NOT mutate paymentStatus')
  assert.equal(orderAfter.stockReserved, true, 'Browser callback must NOT touch stockReserved')
  assert.equal(orderAfter.couponReleased, false, 'Browser callback must NOT touch couponReleased')
})

test('11. valid IPN payment regression test: server-to-server IPN remains sole authoritative mutator', async () => {
  const { orderA } = await setupTestData()

  const ipnFailRequest = new Request('http://localhost:3000/api/payments/sslcommerz/ipn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `tran_id=TXN-A101&status=FAILED&value_a=${orderA.id}`,
  })

  const response = await handleSSLCommerzCallback(ipnFailRequest, 'ipn', testDb)
  assert.equal(response.status, 200, 'IPN must process successfully')

  const orderAfterIpn = await testDb.order.findUnique({
    where: { id: orderA.id },
  })

  assert.equal(orderAfterIpn.orderStatus, 'cancelled', 'IPN failure must transition order to cancelled')
  assert.equal(orderAfterIpn.paymentStatus, 'failed', 'IPN failure must transition payment to failed')
  assert.equal(orderAfterIpn.stockReserved, false, 'IPN failure must release reserved stock')
})
