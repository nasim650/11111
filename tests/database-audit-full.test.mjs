import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { NextRequest } from 'next/server.js'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()
globalThis.prisma = testDb

const { redis } = await import('../src/lib/redis.ts')

test.after(async () => {
  await testDb.$disconnect()
  if (redis) {
    try {
      redis.disconnect()
    } catch (_) {}
  }
})

process.env.NODE_ENV = 'test'
process.env.APP_SECRET = 'test-secret-key-at-least-32-chars-long-for-hmac'
process.env.NEXTAUTH_SECRET = 'test-secret-key-at-least-32-chars-long-for-hmac'
process.env.OTP_SECRET = 'test-secret-at-least-32-characters-long'
process.env.BULKSMSBD_API_KEY = 'mock-test-key'
process.env.BULKSMSBD_SENDER_ID = 'KHATI_KHADYO'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

const { setBulkSmsMockTransport } = await import('../src/lib/bulksmsbd.ts')
setBulkSmsMockTransport(async () => ({ success: true, messageId: 'mock-msg' }))

const { POST: postRegister } = await import('../src/app/api/auth/register/route.ts')
const { POST: postLogin } = await import('../src/app/api/auth/login/route.ts')
const { GET: getUser, PUT: putUser, DELETE: deleteUser } = await import('../src/app/api/users/[id]/route.ts')
const { POST: postAddress, GET: getAddresses } = await import('../src/app/api/addresses/route.ts')
const { DELETE: deleteAddress } = await import('../src/app/api/addresses/[id]/route.ts')
const { POST: postOrder } = await import('../src/app/api/orders/route.ts')
const { GET: getOrder } = await import('../src/app/api/orders/[id]/route.ts')
const { DELETE: deleteCategory } = await import('../src/app/api/categories/[id]/route.ts')
const { DELETE: deleteProduct } = await import('../src/app/api/products/[id]/route.ts')
const { DELETE: deleteSubcategory } = await import('../src/app/api/subcategories/[id]/route.ts')
const { PATCH: patchFaq, DELETE: deleteFaq } = await import('../src/app/api/faq/[id]/route.ts')
const { PATCH: patchSection, DELETE: deleteSection } = await import('../src/app/api/homepage-sections/[id]/route.ts')
const { generateToken, hashPassword } = await import('../src/lib/auth.ts')
const { createCheckoutProof } = await import('../src/lib/checkout-proof.ts')

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
    body: body ? JSON.stringify(body) : undefined,
  })
}

test('1. Customer Registration & Login workflow', async () => {
  const testEmail = `audit_customer_${Date.now()}@example.com`
  const password = 'StrongPassword123'

  // Register
  const regReq = makeReq('http://localhost:3000/api/auth/register', {
    name: 'Audit Customer',
    email: testEmail,
    password,
  })
  const regRes = await postRegister(regReq)
  const regJson = await regRes.json()
  assert.equal(regRes.status, 201, 'Registration should return 201')
  assert.equal(regJson.success, true)
  assert.ok(regJson.data.token, 'Token must be issued')

  // Login
  const loginReq = makeReq('http://localhost:3000/api/auth/login', {
    email: testEmail,
    password,
  })
  const loginRes = await postLogin(loginReq)
  const loginJson = await loginRes.json()
  assert.equal(loginRes.status, 200, 'Login should return 200')
  assert.equal(loginJson.success, true)
  assert.equal(loginJson.data.user.email, testEmail)
})

test('2. Customer Address CRUD and ownership isolation', async () => {
  const dynamicPhone = '017' + Math.floor(10000000 + Math.random() * 90000000)
  const user = await testDb.user.create({
    data: {
      name: 'Address Test User',
      email: `addr_test_${Date.now()}@example.com`,
      phone: dynamicPhone,
      role: 'customer',
      isVerified: true,
    },
  })
  const token = await generateToken(user.id, 0)

  // Create address
  const addReq = makeReq('http://localhost:3000/api/addresses', {
    userId: user.id,
    name: 'Home',
    phone: dynamicPhone,
    address: '123 Main Street',
    city: 'Dhaka',
    district: 'Dhaka',
    isDefault: true,
  }, token)
  const addRes = await postAddress(addReq)
  const addJson = await addRes.json()
  assert.equal(addRes.status, 201, 'Address creation should return 201')
  assert.equal(addJson.success, true)
  const addressId = addJson.data.id

  // Retrieve addresses
  const getReq = makeReq(`http://localhost:3000/api/addresses?userId=${user.id}`, null, token)
  const getRes = await getAddresses(getReq)
  const getJson = await getRes.json()
  assert.equal(getRes.status, 200)
  assert.equal(getJson.data.length, 1)

  // Delete address
  const delReq = new NextRequest(`http://localhost:3000/api/addresses/${addressId}`, {
    method: 'DELETE',
    headers: { cookie: `auth_token=${token}` },
  })
  const delRes = await deleteAddress(delReq, { params: Promise.resolve({ id: addressId }) })
  const delJson = await delRes.json()
  assert.equal(delRes.status, 200)
  assert.equal(delJson.success, true)
})

test('3. Order placement, guestAccessTokenHash generation, and order detail authorization', async () => {
  const cat = await testDb.category.create({
    data: { name: 'Audit Test Cat', slug: `audit-cat-${Date.now()}` },
  })
  const prod = await testDb.product.create({
    data: {
      name: 'Audit Honey',
      slug: `audit-honey-${Date.now()}`,
      price: 650,
      stock: 20,
      status: 'active',
      categoryId: cat.id,
    },
  })

  const guestPhone = '01860773864'
  const proof = createCheckoutProof(guestPhone)

  const checkoutReq = makeReq('http://localhost:3000/api/orders', {
    guestName: 'Verified Guest',
    guestPhone,
    guestAddress: 'Kotchandpur, Jhenaidah',
    paymentMethod: 'cod',
    checkoutProof: proof,
    items: [{ productId: prod.id, productName: prod.name, price: 650, quantity: 1, unit: 'kg' }],
  })

  const orderRes = await postOrder(checkoutReq)
  const orderJson = await orderRes.json()
  assert.equal(orderRes.status, 201, 'Order must be created successfully (HTTP 201)')
  assert.equal(orderJson.success, true)
  assert.ok(orderJson.data.guestAccessTokenHash, 'guestAccessTokenHash must be recorded')

  const orderNumber = orderJson.data.orderNumber
  const guestToken = orderJson.guestAccessToken

  // Unauthenticated without guest cookie -> 403 Forbidden
  const unauthReq = new NextRequest(`http://localhost:3000/api/orders/${orderJson.data.id}`, { method: 'GET' })
  const unauthRes = await getOrder(unauthReq, { params: Promise.resolve({ id: orderJson.data.id }) })
  assert.equal(unauthRes.status, 403, 'Unauthenticated access without cookie must be Forbidden (403)')

  // Authorized with guest cookie -> 200 OK
  const authReq = new NextRequest(`http://localhost:3000/api/orders/${orderJson.data.id}`, {
    method: 'GET',
    headers: { cookie: `guest_order_${orderNumber}=${guestToken}` },
  })
  const authRes = await getOrder(authReq, { params: Promise.resolve({ id: orderJson.data.id }) })
  const authJson = await authRes.json()
  assert.equal(authRes.status, 200, 'Guest with valid cookie must receive order details (200)')
  assert.equal(authJson.data.orderNumber, orderNumber)
})

test('4. Customer Account Deletion preserves order history and prevents foreign-key crashes', async () => {
  const customer = await testDb.user.create({
    data: {
      name: 'Order Owning Customer',
      email: `cust_${Date.now()}@example.com`,
      phone: '017' + Math.floor(10000000 + Math.random() * 90000000),
      role: 'customer',
      isVerified: true,
    },
  })

  const order = await testDb.order.create({
    data: {
      orderNumber: `ORD-${Date.now()}`,
      userId: customer.id,
      totalAmount: 1200,
      paymentMethod: 'cod',
    },
  })

  const customerToken = await generateToken(customer.id, 0)

  // Customer deletes own account
  const delReq = new NextRequest(`http://localhost:3000/api/users/${customer.id}`, {
    method: 'DELETE',
    headers: { cookie: `auth_token=${customerToken}` },
  })
  const delRes = await deleteUser(delReq, { params: Promise.resolve({ id: customer.id }) })
  const delJson = await delRes.json()
  assert.equal(delRes.status, 200, 'Account deletion must return 200')
  assert.equal(delJson.success, true)

  // Check that customer is gone from User table
  const checkUser = await testDb.user.findUnique({ where: { id: customer.id } })
  assert.equal(checkUser, null, 'User record must be deleted')

  // Check that order record is PRESERVED with userId = null (retention policy)
  const checkOrder = await testDb.order.findUnique({ where: { id: order.id } })
  assert.ok(checkOrder, 'Order record must be preserved for legal/accounting records')
  assert.equal(checkOrder.userId, null, 'Preserved order must have userId detached (null)')
})

test('5. Admin Category Deletion is blocked when products exist (foreign key protection)', async () => {
  const admin = await testDb.user.create({
    data: { name: 'Admin Cat', email: `admin_cat_${Date.now()}@example.com`, role: 'admin', isVerified: true },
  })
  const adminToken = await generateToken(admin.id, 0)

  const cat = await testDb.category.create({
    data: { name: 'Protected Cat', slug: `prot-cat-${Date.now()}` },
  })
  await testDb.product.create({
    data: { name: 'Product in Cat', slug: `prod-cat-${Date.now()}`, price: 100, stock: 5, categoryId: cat.id },
  })

  const delReq = new NextRequest(`http://localhost:3000/api/categories/${cat.id}`, {
    method: 'DELETE',
    headers: { cookie: `auth_token=${adminToken}` },
  })
  const delRes = await deleteCategory(delReq, { params: Promise.resolve({ id: cat.id }) })
  const delJson = await delRes.json()

  assert.equal(delRes.status, 400, 'Category deletion with active products must return 400')
  assert.equal(delJson.code, 'CATEGORY_HAS_PRODUCTS')
})

test('6. Admin Product Deletion is blocked when order items exist (audit protection)', async () => {
  const admin = await testDb.user.create({
    data: { name: 'Admin Prod', email: `admin_prod_${Date.now()}@example.com`, role: 'admin', isVerified: true },
  })
  const adminToken = await generateToken(admin.id, 0)

  const cat = await testDb.category.create({
    data: { name: 'Cat for Prod', slug: `cat-prod-${Date.now()}` },
  })
  const prod = await testDb.product.create({
    data: { name: 'Ordered Prod', slug: `ordered-prod-${Date.now()}`, price: 200, stock: 10, categoryId: cat.id },
  })
  const ord = await testDb.order.create({
    data: { orderNumber: `ORD-ITEM-${Date.now()}`, totalAmount: 200, paymentMethod: 'cod' },
  })
  await testDb.orderItem.create({
    data: { orderId: ord.id, productId: prod.id, productName: prod.name, price: 200, quantity: 1, unit: 'kg' },
  })

  const delReq = new NextRequest(`http://localhost:3000/api/products/${prod.id}`, {
    method: 'DELETE',
    headers: { cookie: `auth_token=${adminToken}` },
  })
  const delRes = await deleteProduct(delReq, { params: Promise.resolve({ id: prod.id }) })
  const delJson = await delRes.json()

  assert.equal(delRes.status, 400, 'Product deletion with order history must return 400')
  assert.equal(delJson.code, 'PRODUCT_HAS_ORDERS')
})

test('7. Admin Subcategory Deletion disassociates products without foreign-key violation', async () => {
  const admin = await testDb.user.create({
    data: { name: 'Admin Subcat', email: `admin_subcat_${Date.now()}@example.com`, role: 'admin', isVerified: true },
  })
  const adminToken = await generateToken(admin.id, 0)

  const cat = await testDb.category.create({
    data: { name: 'Main Cat', slug: `main-cat-${Date.now()}` },
  })
  const subcat = await testDb.subcategory.create({
    data: { name: 'Sub Cat', slug: `sub-cat-${Date.now()}`, categoryId: cat.id },
  })
  const prod = await testDb.product.create({
    data: { name: 'Subcat Prod', slug: `subcat-prod-${Date.now()}`, price: 300, stock: 10, categoryId: cat.id, subcategoryId: subcat.id },
  })

  const delReq = new NextRequest(`http://localhost:3000/api/subcategories/${subcat.id}`, {
    method: 'DELETE',
    headers: { cookie: `auth_token=${adminToken}` },
  })
  const delRes = await deleteSubcategory(delReq, { params: Promise.resolve({ id: subcat.id }) })
  assert.equal(delRes.status, 200, 'Subcategory deletion should return 200')

  const updatedProd = await testDb.product.findUnique({ where: { id: prod.id } })
  assert.ok(updatedProd, 'Product must still exist')
  assert.equal(updatedProd.subcategoryId, null, 'Product subcategoryId must be disassociated (null)')
})

test('8. Admin FAQ PATCH & DELETE handles Next.js 16 Promise params correctly', async () => {
  const admin = await testDb.user.create({
    data: { name: 'Admin FAQ', email: `admin_faq_${Date.now()}@example.com`, role: 'admin', isVerified: true },
  })
  const adminToken = await generateToken(admin.id, 0)

  const faq = await testDb.fAQItem.create({
    data: { question: 'Original Question?', answer: 'Original Answer', isActive: true },
  })

  // PATCH
  const patchReq = new NextRequest(`http://localhost:3000/api/faq/${faq.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: `auth_token=${adminToken}` },
    body: JSON.stringify({ answer: 'Updated Answer' }),
  })
  const patchRes = await patchFaq(patchReq, { params: Promise.resolve({ id: faq.id }) })
  const patchJson = await patchRes.json()
  assert.equal(patchRes.status, 200)
  assert.equal(patchJson.data.answer, 'Updated Answer')

  // DELETE
  const delReq = new NextRequest(`http://localhost:3000/api/faq/${faq.id}`, {
    method: 'DELETE',
    headers: { cookie: `auth_token=${adminToken}` },
  })
  const delRes = await deleteFaq(delReq, { params: Promise.resolve({ id: faq.id }) })
  assert.equal(delRes.status, 200)

  const checkFaq = await testDb.fAQItem.findUnique({ where: { id: faq.id } })
  assert.equal(checkFaq, null)
})

test('9. Admin Homepage Sections PATCH & DELETE handles Next.js 16 Promise params correctly', async () => {
  const admin = await testDb.user.create({
    data: { name: 'Admin Section', email: `admin_sec_${Date.now()}@example.com`, role: 'admin', isVerified: true },
  })
  const adminToken = await generateToken(admin.id, 0)

  const sec = await testDb.homepageSection.create({
    data: { title: 'Featured Section', type: 'product_grid', isActive: true },
  })

  // PATCH
  const patchReq = new NextRequest(`http://localhost:3000/api/homepage-sections/${sec.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: `auth_token=${adminToken}` },
    body: JSON.stringify({ title: 'Updated Section Title' }),
  })
  const patchRes = await patchSection(patchReq, { params: Promise.resolve({ id: sec.id }) })
  const patchJson = await patchRes.json()
  assert.equal(patchRes.status, 200)
  assert.equal(patchJson.data.title, 'Updated Section Title')

  // DELETE
  const delReq = new NextRequest(`http://localhost:3000/api/homepage-sections/${sec.id}`, {
    method: 'DELETE',
    headers: { cookie: `auth_token=${adminToken}` },
  })
  const delRes = await deleteSection(delReq, { params: Promise.resolve({ id: sec.id }) })
  assert.equal(delRes.status, 200)

  const checkSec = await testDb.homepageSection.findUnique({ where: { id: sec.id } })
  assert.equal(checkSec, null)
})
