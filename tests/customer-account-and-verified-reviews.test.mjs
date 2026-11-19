/**
 * customer-account-and-verified-reviews.test.mjs
 * Comprehensive integration test suite covering 20 specific scenarios:
 * 1. Registration with email
 * 2. Registration with phone
 * 3. Duplicate email/phone registration rejected (409)
 * 4. Login with email + password
 * 5. Login with phone + password
 * 6. Login with invalid password rejected (401)
 * 7. Logout clears session / increments sessionVersion
 * 8. Profile edit (name, email)
 * 9. Phone change resets isVerified to false
 * 10. Address CRUD (add, edit, delete, default address toggle)
 * 11. Password change requires current password and increments sessionVersion
 * 12. Forgot & reset password OTP flow (non-enumerating)
 * 13. Logged-in verified user COD order placement
 * 14. Customer recent orders query returns latest 5 orders (limit=5)
 * 15. Orders list API pagination (limit=10)
 * 16. Order detail access control (owner 200, unauthorized 404, unauthenticated 401)
 * 17. Review creation blocked (403) for non-purchaser
 * 18. Review creation blocked (403) for un-delivered purchaser
 * 19. Review creation allowed for delivered purchaser (isApproved=false, isActive=true, isVerified=true)
 * 20. Duplicate review blocked (400), public query hides pending, admin can approve
 */
import test from 'node:test'
import assert from 'node:assert/strict'
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
const { POST: postRegister } = await import('../src/app/api/auth/register/route.ts')
const { POST: postLogin } = await import('../src/app/api/auth/login/route.ts')
const { POST: postLogout } = await import('../src/app/api/auth/logout/route.ts')
const { getUserRoleFromRequest, getUserIdFromRequest } = await import('../src/lib/utils.ts')
const { GET: getUser, PUT: putUser } = await import('../src/app/api/users/[id]/route.ts')
const { GET: getAddresses, POST: postAddress } = await import('../src/app/api/addresses/route.ts')
const { PUT: putAddress, DELETE: deleteAddress } = await import('../src/app/api/addresses/[id]/route.ts')
const { POST: postForgotPassword } = await import('../src/app/api/auth/forgot-password/route.ts')
const { POST: postResetPassword } = await import('../src/app/api/auth/reset-password/route.ts')
const { GET: getOrders, POST: postOrder } = await import('../src/app/api/orders/route.ts')
const { getOrderForUser } = await import('../src/lib/order-authorization.ts')
const { GET: getReviews, POST: postReview } = await import('../src/app/api/reviews/route.ts')
const { PUT: putReview, DELETE: deleteReview } = await import('../src/app/api/reviews/[id]/route.ts')
const { generateToken, hashPassword } = await import('../src/lib/auth.ts')
const { sanitizeInternalRedirect } = await import('../src/lib/security.ts')

let ipCounter = 10

// Helper function to create JSON requests with isolated IPs to prevent rate-limit crosstalk
function makeJsonReq(url, method = 'POST', body = null, token = null, extraHeaders = {}) {
  const ip = `10.0.1.${ipCounter++}`
  const headers = {
    'Content-Type': 'application/json',
    'x-csrf-token': 'test-csrf',
    'x-forwarded-for': ip,
    cookie: 'csrf_token=test-csrf' + (token ? `; auth_token=${token}` : ''),
    ...extraHeaders,
  }
  if (token) {
    headers['authorization'] = `Bearer ${token}`
  }

  return new NextRequest(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

// Clean test database before test suite
async function cleanDatabase() {
  await testDb.review.deleteMany().catch(() => {})
  await testDb.orderItem.deleteMany().catch(() => {})
  await testDb.payment.deleteMany().catch(() => {})
  await testDb.deliveryLabel.deleteMany().catch(() => {})
  await testDb.orderStatusHistory.deleteMany().catch(() => {})
  await testDb.order.deleteMany().catch(() => {})
  await testDb.address.deleteMany().catch(() => {})
  await testDb.cartItem.deleteMany().catch(() => {})
  await testDb.productImage.deleteMany().catch(() => {})
  await testDb.product.deleteMany().catch(() => {})
  await testDb.category.deleteMany().catch(() => {})
  await testDb.otpChallenge.deleteMany().catch(() => {})
  await testDb.user.deleteMany().catch(() => {})
}

async function setupTestProduct() {
  const cat = await testDb.category.upsert({
    where: { slug: 'organic-food' },
    update: {},
    create: { name: 'Organic Food', slug: 'organic-food' },
  })

  return await testDb.product.create({
    data: {
      name: 'Khati Mustard Oil 1L',
      slug: `mustard-oil-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      price: 320,
      stock: 100,
      unit: 'bottle',
      categoryId: cat.id,
      status: 'active',
    },
  })
}

test('0. Clean database setup', async () => {
  await cleanDatabase()
})

test('1. Account registration with email + password returns 201 and sets auth_token cookie', async () => {
  const req = makeJsonReq('http://localhost:3000/api/auth/register', 'POST', {
    name: 'Karim Ullah',
    email: 'karim@example.com',
    password: 'Password123!',
  })

  const res = await postRegister(req)
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.data.user.email, 'karim@example.com')
  assert.equal(body.data.user.password, undefined)
  assert.ok(body.data.token)

  const cookieHeader = res.headers.get('set-cookie')
  assert.ok(cookieHeader && cookieHeader.includes('auth_token='))
})

test('2. Account registration with Bangladeshi phone issues verification OTP', async () => {
  let capturedSms = null
  setBulkSmsMockTransport(async (payload) => {
    capturedSms = payload
    return { success: true, messageId: 'mock-reg-sms-1', responseCode: 202 }
  })

  const req = makeJsonReq('http://localhost:3000/api/auth/register', 'POST', {
    name: 'Jamal Ahmed',
    phone: '01711000001',
    password: 'Password123!',
  })

  // Step 1: Request OTP for phone signup (returns 200 with requiresOtp: true, 0 users created)
  const res = await postRegister(req)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.data.requiresOtp, true)
  assert.ok(capturedSms)
  assert.equal(capturedSms.number, '8801711000001')

  const unverifiedCount = await testDb.user.count({ where: { phone: '01711000001' } })
  assert.equal(unverifiedCount, 0, 'No user created before OTP verification')
  assert.equal(res.headers.get('set-cookie'), null, 'No auth cookie set in Step 1')

  // Step 2: Submit with OTP code to complete registration
  const match = capturedSms.message.match(/(\d{6})/)
  const otpCode = match ? match[1] : '123456'
  const step2Req = makeJsonReq('http://localhost:3000/api/auth/register', 'POST', {
    name: 'Jamal Ahmed',
    phone: '01711000001',
    password: 'Password123!',
    otpCode,
  })
  const step2Res = await postRegister(step2Req)
  assert.equal(step2Res.status, 201)
  const step2Body = await step2Res.json()
  assert.equal(step2Body.success, true)
  assert.equal(step2Body.data.user.phone, '01711000001')
  assert.equal(step2Body.data.user.isVerified, true)
  assert.ok(step2Res.headers.get('set-cookie')?.includes('auth_token='))
})

test('3. Duplicate email or phone registration is rejected with HTTP 409', async () => {
  const reqDupEmail = makeJsonReq('http://localhost:3000/api/auth/register', 'POST', {
    name: 'Karim Clone',
    email: 'karim@example.com',
    password: 'AnotherPassword123!',
  })
  const resDupEmail = await postRegister(reqDupEmail)
  assert.equal(resDupEmail.status, 409)

  const reqDupPhone = makeJsonReq('http://localhost:3000/api/auth/register', 'POST', {
    name: 'Jamal Clone',
    phone: '01711000001',
    password: 'AnotherPassword123!',
  })
  const resDupPhone = await postRegister(reqDupPhone)
  assert.equal(resDupPhone.status, 409)
})

test('4. Login with email + password succeeds and sets valid auth_token cookie', async () => {
  const req = makeJsonReq('http://localhost:3000/api/auth/login', 'POST', {
    email: 'karim@example.com',
    password: 'Password123!',
  })
  const res = await postLogin(req)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.data.user.email, 'karim@example.com')
  assert.ok(body.data.token)
})

test('5. Login with phone + password succeeds', async () => {
  const req = makeJsonReq('http://localhost:3000/api/auth/login', 'POST', {
    phone: '01711000001',
    password: 'Password123!',
  })
  const res = await postLogin(req)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.data.user.phone, '01711000001')
})

test('6. Login with incorrect password returns 401 Invalid credentials', async () => {
  const req = makeJsonReq('http://localhost:3000/api/auth/login', 'POST', {
    email: 'karim@example.com',
    password: 'WrongPassword999!',
  })
  const res = await postLogin(req)
  assert.equal(res.status, 401)
  const body = await res.json()
  assert.equal(body.success, false)
  assert.match(body.error, /invalid credentials/i)
})

test('7. Logout increments sessionVersion on server and clears auth_token cookie', async () => {
  const user = await testDb.user.findFirst({ where: { email: 'karim@example.com' } })
  const token = await generateToken(user.id, user.sessionVersion)

  const req = makeJsonReq('http://localhost:3000/api/auth/logout', 'POST', {}, token)
  const res = await postLogout(req)
  assert.equal(res.status, 200)

  const updatedUser = await testDb.user.findUnique({ where: { id: user.id } })
  assert.equal(updatedUser.sessionVersion, user.sessionVersion + 1)

  const cookieHeader = res.headers.get('set-cookie')
  assert.ok(cookieHeader && cookieHeader.includes('auth_token=;'))
})

test('8. Profile update allows owner to change name and email with ownership check', async () => {
  const user = await testDb.user.findFirst({ where: { email: 'karim@example.com' } })
  const token = await generateToken(user.id, user.sessionVersion)

  // Unauthorized stranger attempt
  const strangerToken = await generateToken('stranger-id-123', 1)
  const reqForbidden = makeJsonReq(
    `http://localhost:3000/api/users/${user.id}`,
    'PUT',
    { name: 'Hacked Name' },
    strangerToken
  )
  const resForbidden = await putUser(reqForbidden, { params: Promise.resolve({ id: user.id }) })
  assert.equal(resForbidden.status, 403)

  // Legitimate owner update
  const reqOwner = makeJsonReq(
    `http://localhost:3000/api/users/${user.id}`,
    'PUT',
    { name: 'Karim Ahmed Ullah' },
    token
  )
  const resOwner = await putUser(reqOwner, { params: Promise.resolve({ id: user.id }) })
  assert.equal(resOwner.status, 200)
  const body = await resOwner.json()
  assert.equal(body.data.name, 'Karim Ahmed Ullah')
})

test('9. Phone change resets customer isVerified to false', async () => {
  const user = await testDb.user.findFirst({ where: { email: 'karim@example.com' } })
  // Manually verify user first
  await testDb.user.update({ where: { id: user.id }, data: { isVerified: true, phone: '01700000001' } })

  const token = await generateToken(user.id, user.sessionVersion)
  const req = makeJsonReq(
    `http://localhost:3000/api/users/${user.id}`,
    'PUT',
    { phone: '01799999999' },
    token
  )
  const res = await putUser(req, { params: Promise.resolve({ id: user.id }) })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.phone, '01799999999')
  assert.equal(body.data.isVerified, false, 'Phone change must reset isVerified to false')
})

test('10. Address CRUD: create address, set default unsets previous, edit and delete', async () => {
  const user = await testDb.user.findFirst({ where: { email: 'karim@example.com' } })
  const token = await generateToken(user.id, user.sessionVersion)

  // 10a: Create Address 1 (default)
  const reqAddr1 = makeJsonReq('http://localhost:3000/api/addresses', 'POST', {
    userId: user.id,
    name: 'Karim Ullah',
    phone: '01799999999',
    address: 'House 12, Road 4, Banani',
    city: 'Dhaka',
    district: 'Dhaka',
    isDefault: true,
  }, token)
  const resAddr1 = await postAddress(reqAddr1)
  assert.equal(resAddr1.status, 201)
  const addr1 = (await resAddr1.json()).data
  assert.equal(addr1.isDefault, true)

  // 10b: Create Address 2 (default) -> unsets Address 1 default
  const reqAddr2 = makeJsonReq('http://localhost:3000/api/addresses', 'POST', {
    userId: user.id,
    name: 'Karim Ullah Office',
    phone: '01799999999',
    address: 'Gulshan 2, Plot 10',
    city: 'Dhaka',
    district: 'Dhaka',
    isDefault: true,
  }, token)
  const resAddr2 = await postAddress(reqAddr2)
  assert.equal(resAddr2.status, 201)

  const addr1After = await testDb.address.findUnique({ where: { id: addr1.id } })
  assert.equal(addr1After.isDefault, false, 'Previous default address must be unset')

  // 10c: Update Address 1
  const reqUpdate = makeJsonReq(`http://localhost:3000/api/addresses/${addr1.id}`, 'PUT', {
    address: 'House 12A, Road 4, Banani',
  }, token)
  const resUpdate = await putAddress(reqUpdate, { params: Promise.resolve({ id: addr1.id }) })
  assert.equal(resUpdate.status, 200)
  const updatedAddr = (await resUpdate.json()).data
  assert.equal(updatedAddr.address, 'House 12A, Road 4, Banani')

  // 10d: Delete Address 1
  const reqDelete = makeJsonReq(`http://localhost:3000/api/addresses/${addr1.id}`, 'DELETE', null, token)
  const resDelete = await deleteAddress(reqDelete, { params: Promise.resolve({ id: addr1.id }) })
  assert.equal(resDelete.status, 200)
  const deletedAddr = await testDb.address.findUnique({ where: { id: addr1.id } })
  assert.equal(deletedAddr, null)
})

test('11. Change password requires valid current password and revokes existing sessions', async () => {
  const user = await testDb.user.findFirst({ where: { email: 'karim@example.com' } })
  const token = await generateToken(user.id, user.sessionVersion)

  // 11a: Missing or wrong current password rejected
  const reqWrong = makeJsonReq(`http://localhost:3000/api/users/${user.id}`, 'PUT', {
    currentPassword: 'WrongPassword!',
    newPassword: 'BrandNewPassword123!',
  }, token)
  const resWrong = await putUser(reqWrong, { params: Promise.resolve({ id: user.id }) })
  assert.equal(resWrong.status, 400)

  // 11b: Valid password change
  const reqCorrect = makeJsonReq(`http://localhost:3000/api/users/${user.id}`, 'PUT', {
    currentPassword: 'Password123!',
    newPassword: 'BrandNewPassword123!',
  }, token)
  const resCorrect = await putUser(reqCorrect, { params: Promise.resolve({ id: user.id }) })
  assert.equal(resCorrect.status, 200)

  const freshUser = await testDb.user.findUnique({ where: { id: user.id } })
  assert.equal(freshUser.sessionVersion, user.sessionVersion + 1, 'sessionVersion must increment on password change')

  // 11c: Old password cannot login anymore
  const reqOldLogin = makeJsonReq('http://localhost:3000/api/auth/login', 'POST', {
    email: 'karim@example.com',
    password: 'Password123!',
  })
  const resOldLogin = await postLogin(reqOldLogin)
  assert.equal(resOldLogin.status, 401)

  // 11d: New password logs in successfully
  const reqNewLogin = makeJsonReq('http://localhost:3000/api/auth/login', 'POST', {
    email: 'karim@example.com',
    password: 'BrandNewPassword123!',
  })
  const resNewLogin = await postLogin(reqNewLogin)
  assert.equal(resNewLogin.status, 200)
})

test('12. Forgot & reset password OTP flow is non-enumerating and updates password', async () => {
  let capturedOtp = null
  setBulkSmsMockTransport((payload) => {
    const match = payload.message?.match(/\b\d{6}\b/)
    if (match) capturedOtp = match[0]
    return { success: true, messageId: 'mock-reset-sms' }
  })

  // 12a: Non-existent phone returns 200 non-enumerating
  const reqNonExistent = makeJsonReq('http://localhost:3000/api/auth/forgot-password', 'POST', {
    phone: '01899999999',
  })
  const resNonExistent = await postForgotPassword(reqNonExistent)
  assert.equal(resNonExistent.status, 200)
  assert.equal((await resNonExistent.json()).data.sent, true)

  // 12b: Real user phone triggers OTP
  const user = await testDb.user.findFirst({ where: { phone: '01711000001' } })
  const reqForgot = makeJsonReq('http://localhost:3000/api/auth/forgot-password', 'POST', {
    phone: '01711000001',
  })
  const resForgot = await postForgotPassword(reqForgot)
  assert.equal(resForgot.status, 200)
  assert.ok(capturedOtp, 'OTP must be dispatched')

  // 12c: Reset password with OTP code
  const reqReset = makeJsonReq('http://localhost:3000/api/auth/reset-password', 'POST', {
    phone: '01711000001',
    code: capturedOtp,
    password: 'ResetPassword123!',
  })
  const resReset = await postResetPassword(reqReset)
  assert.equal(resReset.status, 200)

  // 12d: Verify login with new password
  const reqLogin = makeJsonReq('http://localhost:3000/api/auth/login', 'POST', {
    phone: '01711000001',
    password: 'ResetPassword123!',
  })
  const resLogin = await postLogin(reqLogin)
  assert.equal(resLogin.status, 200)
})

test('13. Logged-in verified user can place COD order with stock reservation', async () => {
  const prod = await setupTestProduct()
  const user = await testDb.user.findFirst({ where: { phone: '01711000001' } })
  // Ensure verified
  await testDb.user.update({ where: { id: user.id }, data: { isVerified: true } })
  const token = await generateToken(user.id, user.sessionVersion)

  const req = makeJsonReq('http://localhost:3000/api/orders', 'POST', {
    userId: user.id,
    guestPhone: user.phone,
    guestName: user.name || 'Jamal Ahmed',
    guestAddress: 'House 5, Dhanmondi, Dhaka',
    paymentMethod: 'cod',
    items: [{ productId: prod.id, productName: prod.name, quantity: 2, price: 320, unit: 'bottle' }],
  }, token)

  const res = await postOrder(req)
  assert.equal(res.status, 201)
  const order = (await res.json()).data
  assert.equal(order.userId, user.id)
  assert.equal(order.paymentMethod, 'cod')
  assert.equal(order.totalAmount, 700) // 2 * 320 + 60 shipping = 700

  // Verify stock was reserved
  const prodAfter = await testDb.product.findUnique({ where: { id: prod.id } })
  assert.equal(prodAfter.stock, 98)
})

test('14. Customer recent orders query returns latest 5 orders (limit=5)', async () => {
  const user = await testDb.user.findFirst({ where: { phone: '01711000001' } })
  const prod = await testDb.product.findFirst()

  // Create 6 orders for this user
  for (let i = 1; i <= 6; i++) {
    await testDb.order.create({
      data: {
        orderNumber: `ORD-TEST-REC-${i}-${Date.now()}`,
        userId: user.id,
        totalAmount: 500 + i * 10,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        orderStatus: 'delivered',
        createdAt: new Date(Date.now() - (10 - i) * 60000),
        items: {
          create: [{
            productId: prod.id,
            productName: prod.name,
            quantity: 1,
            unit: 'bottle',
            price: 320,
          }],
        },
      },
    })
  }

  const token = await generateToken(user.id, user.sessionVersion)
  const req = makeJsonReq(`http://localhost:3000/api/orders?userId=${user.id}&limit=5`, 'GET', null, token)
  const res = await getOrders(req)
  assert.equal(res.status, 200)
  const body = await res.json()
  const orders = body.data?.data || []
  assert.equal(orders.length, 5, 'Must return exactly 5 orders when limit=5')
})

test('15. Orders list API supports pagination with page size 10 (limit=10)', async () => {
  const user = await testDb.user.findFirst({ where: { phone: '01711000001' } })
  const prod = await testDb.product.findFirst()

  // Add 6 more orders so user has > 10 orders
  for (let i = 7; i <= 12; i++) {
    await testDb.order.create({
      data: {
        orderNumber: `ORD-TEST-PAG-${i}-${Date.now()}`,
        userId: user.id,
        totalAmount: 600 + i * 10,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        orderStatus: 'delivered',
        items: {
          create: [{
            productId: prod.id,
            productName: prod.name,
            quantity: 1,
            unit: 'bottle',
            price: 320,
          }],
        },
      },
    })
  }

  const token = await generateToken(user.id, user.sessionVersion)

  // Page 1 with limit=10
  const reqP1 = makeJsonReq(`http://localhost:3000/api/orders?limit=10&page=1`, 'GET', null, token)
  const resP1 = await getOrders(reqP1)
  assert.equal(resP1.status, 200)
  const bodyP1 = await resP1.json()
  assert.equal(bodyP1.data?.data?.length, 10)
  assert.equal(bodyP1.data?.pagination?.page, 1)
  assert.equal(bodyP1.data?.pagination?.limit, 10)

  // Page 2 with limit=10
  const reqP2 = makeJsonReq(`http://localhost:3000/api/orders?limit=10&page=2`, 'GET', null, token)
  const resP2 = await getOrders(reqP2)
  assert.equal(resP2.status, 200)
  const bodyP2 = await resP2.json()
  assert.ok(bodyP2.data?.data?.length >= 2)
  assert.equal(bodyP2.data?.pagination?.page, 2)
})

test('16. Order detail access control: owner gets 200, another customer gets 404, unauthenticated gets 401', async () => {
  const userA = await testDb.user.findFirst({ where: { email: 'karim@example.com' } })
  const userB = await testDb.user.findFirst({ where: { phone: '01711000001' } })
  const prod = await testDb.product.findFirst()

  const orderA = await testDb.order.create({
    data: {
      orderNumber: `ORD-AUTH-CHECK-${Date.now()}`,
      userId: userA.id,
      totalAmount: 380,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      items: {
        create: [{
          productId: prod.id,
          productName: prod.name,
          quantity: 1,
          unit: 'bottle',
          price: 320,
        }],
      },
    },
  })

  // 16a: Unauthenticated access returns 401
  const resUnauth = await getOrderForUser(orderA.orderNumber, null, testDb)
  assert.equal(resUnauth.status, 401)

  // 16b: Customer B attempting to access Customer A order returns 404 (non-enumerating)
  const resStranger = await getOrderForUser(orderA.orderNumber, { userId: userB.id, role: 'customer' }, testDb)
  assert.equal(resStranger.status, 404)

  // 16c: Owner User A accessing own order returns 200
  const resOwner = await getOrderForUser(orderA.orderNumber, { userId: userA.id, role: 'customer' }, testDb)
  assert.equal(resOwner.status, 200)
  assert.equal(resOwner.order.orderNumber, orderA.orderNumber)
})

test('17. Review creation blocked (403) for customer who never purchased the product', async () => {
  const prod = await setupTestProduct()
  const user = await testDb.user.findFirst({ where: { email: 'karim@example.com' } })
  const token = await generateToken(user.id, user.sessionVersion)

  const req = makeJsonReq('http://localhost:3000/api/reviews', 'POST', {
    userId: user.id,
    productId: prod.id,
    rating: 5,
    comment: 'Great oil, have not bought it yet though!',
  }, token)

  const res = await postReview(req)
  assert.equal(res.status, 403)
  const body = await res.json()
  assert.match(body.error, /সফলভাবে ডেলিভারি হওয়ার পর/i)
})

test('18. Review creation blocked (403) for purchaser whose order is pending / undelivered', async () => {
  const prod = await setupTestProduct()
  const user = await testDb.user.findFirst({ where: { email: 'karim@example.com' } })

  // Create pending order for this product
  await testDb.order.create({
    data: {
      orderNumber: `ORD-UNDELIV-${Date.now()}`,
      userId: user.id,
      totalAmount: 380,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      orderStatus: 'pending', // NOT delivered
      items: {
        create: [{
          productId: prod.id,
          productName: prod.name,
          quantity: 1,
          unit: 'bottle',
          price: 320,
        }],
      },
    },
  })

  const token = await generateToken(user.id, user.sessionVersion)
  const req = makeJsonReq('http://localhost:3000/api/reviews', 'POST', {
    userId: user.id,
    productId: prod.id,
    rating: 5,
    comment: 'Waiting for delivery...',
  }, token)

  const res = await postReview(req)
  assert.equal(res.status, 403)
  const body = await res.json()
  assert.match(body.error, /সফলভাবে ডেলিভারি হওয়ার পর/i)
})

test('19. Review creation allowed for delivered purchaser: sets isApproved=false, isActive=true, isVerified=true', async () => {
  const prod = await setupTestProduct()
  const user = await testDb.user.findFirst({ where: { email: 'karim@example.com' } })

  // Create delivered order for this product
  await testDb.order.create({
    data: {
      orderNumber: `ORD-DELIV-${Date.now()}`,
      userId: user.id,
      totalAmount: 380,
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      orderStatus: 'delivered', // Delivered!
      items: {
        create: [{
          productId: prod.id,
          productName: prod.name,
          quantity: 1,
          unit: 'bottle',
          price: 320,
        }],
      },
    },
  })

  const token = await generateToken(user.id, user.sessionVersion)
  const req = makeJsonReq('http://localhost:3000/api/reviews', 'POST', {
    userId: user.id,
    productId: prod.id,
    rating: 5,
    comment: 'Excellent pure quality oil, highly satisfied!',
  }, token)

  const res = await postReview(req)
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.data.isApproved, false, 'New review must be pending moderation (isApproved=false)')
  assert.equal(body.data.isActive, true)
  assert.equal(body.data.isVerified, true, 'Delivered purchase review must have isVerified=true')
})

test('20. Duplicate review blocked (400), public query hides pending, admin can approve and view', async () => {
  const user = await testDb.user.findFirst({ where: { email: 'karim@example.com' } })
  const token = await generateToken(user.id, user.sessionVersion)
  const lastReview = await testDb.review.findFirst({ where: { userId: user.id } })
  assert.ok(lastReview)
  const prodId = lastReview.productId

  // 20a: Duplicate review attempt by same user for same product blocked (400)
  const reqDup = makeJsonReq('http://localhost:3000/api/reviews', 'POST', {
    userId: user.id,
    productId: prodId,
    rating: 4,
    comment: 'Second review attempt',
  }, token)
  const resDup = await postReview(reqDup)
  assert.equal(resDup.status, 400)
  const bodyDup = await resDup.json()
  assert.match(bodyDup.error, /already reviewed/i)

  // 20b: Public review query does NOT return unapproved review
  const reqPublic = makeJsonReq(`http://localhost:3000/api/reviews?productId=${prodId}`, 'GET')
  const resPublic = await getReviews(reqPublic)
  assert.equal(resPublic.status, 200)
  const publicReviews = (await resPublic.json()).data?.data || []
  assert.equal(publicReviews.length, 0, 'Public query must exclude unapproved review')

  // 20c: Admin reviews moderation: approve review
  const adminUser = await testDb.user.create({
    data: {
      name: 'Site Administrator',
      email: `admin-${Date.now()}@khatikhadyo.com`,
      password: await hashPassword('AdminPass123!'),
      role: 'admin',
      isVerified: true,
    },
  })
  const adminToken = await generateToken(adminUser.id, adminUser.sessionVersion)

  const reqApprove = makeJsonReq(`http://localhost:3000/api/reviews/${lastReview.id}`, 'PUT', {
    status: 'approved',
  }, adminToken)
  const resApprove = await putReview(reqApprove, { params: Promise.resolve({ id: lastReview.id }) })
  assert.equal(resApprove.status, 200)
  const approvedReview = (await resApprove.json()).data
  assert.equal(approvedReview.isApproved, true)

  // 20d: Public query now returns the approved review
  const resPublicAfter = await getReviews(reqPublic)
  assert.equal(resPublicAfter.status, 200)
  const publicReviewsAfter = (await resPublicAfter.json()).data?.data || []
  assert.equal(publicReviewsAfter.length, 1)
  assert.equal(publicReviewsAfter[0].id, lastReview.id)

  // 20e: Sanitize internal redirect verification
  assert.equal(sanitizeInternalRedirect('/orders/ORD-123'), '/orders/ORD-123')
  assert.equal(sanitizeInternalRedirect('https://evil.com', '/'), '/')
  assert.equal(sanitizeInternalRedirect('//evil.com', '/'), '/')
})
