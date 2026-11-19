import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

process.env.NODE_ENV = 'test'
process.env.SMS_PROVIDER = 'cloudsmsbd'
process.env.CLOUDSMSBD_API_KEY = 'test-cloudsms-api-key-secret-12345'
process.env.CLOUDSMSBD_SENDER_ID = 'KHATIKHADYO'
process.env.CLOUDSMSBD_API_URL = 'https://p1.cloudsmsbd.com/api/sms'
process.env.OTP_SECRET = 'test-secret-at-least-32-characters-long'
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()
globalThis.prisma = testDb

const { POST: postRegister } = await import('../src/app/api/auth/register/route.ts')
const { setCloudSmsMockTransport, CloudSmsError } = await import('../src/lib/cloudsmsbd.ts')
const { issueOtp } = await import('../src/lib/otp.ts')

let ipCounter = 1

function makeRequest(body, headers = {}) {
  const ip = `10.0.9.${ipCounter++}`
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function randomPhone() {
  const digits = Math.floor(10000000 + Math.random() * 90000000).toString()
  return `017${digits.slice(0, 8)}`
}

test('0. Clean database setup', async () => {
  await testDb.otpChallenge.deleteMany()
  await testDb.orderItem.deleteMany()
  await testDb.payment.deleteMany()
  await testDb.order.deleteMany()
  await testDb.user.deleteMany()
})

test('1. Phone signup Step 1 sends OTP, creates 0 users in DB, and sets NO auth_token cookie', async () => {
  const phone = randomPhone()
  let capturedPayload = null

  setCloudSmsMockTransport(async (payload) => {
    capturedPayload = payload
    return { success: true, code: 1, messageId: 'mock-sms-step1' }
  })

  const req = makeRequest({
    name: 'Rahim Uddin',
    phone,
    password: 'SecurePassword123!',
  })

  const res = await postRegister(req)
  assert.equal(res.status, 200, 'Step 1 must return HTTP 200')

  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.data.requiresOtp, true)
  assert.equal(body.data.phone, phone)
  assert.ok(body.data.expiresInSeconds > 0)
  assert.equal(body.data.claimProfile, false)

  // Verify SMS was sent
  assert.ok(capturedPayload, 'SMS payload must be dispatched')
  assert.equal(capturedPayload.number, `88${phone}`)

  // Verify strictly ZERO users created in DB
  const userCount = await testDb.user.count({ where: { phone } })
  assert.equal(userCount, 0, 'Step 1 MUST NOT create any user in the database')

  // Verify strictly NO auth_token cookie is issued
  const setCookie = res.headers.get('set-cookie')
  assert.equal(setCookie, null, 'Step 1 MUST NOT set any auth_token cookie')
})

test('2. Phone signup Step 1 fails cleanly (503) if SMS delivery fails, with 0 users created', async () => {
  const phone = randomPhone()

  // Simulate gateway failure
  setCloudSmsMockTransport(async () => {
    throw new CloudSmsError('Gateway timeout', 101, 'এসএমএস গেটওয়ে সাময়িক বিভ্রাটে রয়েছে')
  })

  const req = makeRequest({
    name: 'Failing SMS User',
    phone,
    password: 'SecurePassword123!',
  })

  const res = await postRegister(req)
  assert.equal(res.status, 503, 'Failed SMS delivery must return HTTP 503')

  const body = await res.json()
  assert.equal(body.success, false)
  assert.match(body.error, /এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ|বিভ্রাট/)

  // Verify strictly 0 users created in DB
  const userCount = await testDb.user.count({ where: { phone } })
  assert.equal(userCount, 0, 'No user must be created when SMS delivery fails')
  assert.equal(res.headers.get('set-cookie'), null)
})

test('3. Wrong OTP in Step 2 returns 400 and creates 0 users in DB', async () => {
  const phone = randomPhone()
  let capturedOtp = null

  setCloudSmsMockTransport(async (payload) => {
    const match = payload.sms.match(/(\d{6})/)
    if (match) capturedOtp = match[1]
    return { success: true, code: 1, messageId: 'mock-sms-step2' }
  })

  // 1. Step 1: Issue OTP
  const step1Res = await postRegister(
    makeRequest({
      name: 'Wrong OTP Candidate',
      phone,
      password: 'SecurePassword123!',
    })
  )
  assert.equal(step1Res.status, 200)
  assert.ok(capturedOtp, 'OTP must be captured')

  // 2. Step 2: Submit with incorrect OTP code '000000'
  const step2Req = makeRequest({
    name: 'Wrong OTP Candidate',
    phone,
    password: 'SecurePassword123!',
    otpCode: '000000',
  })
  const step2Res = await postRegister(step2Req)
  assert.equal(step2Res.status, 400, 'Invalid OTP must return HTTP 400')

  const step2Body = await step2Res.json()
  assert.equal(step2Body.success, false)
  assert.match(step2Body.error, /ওটিপি কোডটি সঠিক নয়|invalid|expired/i)

  // Verify strictly 0 users created in DB
  const userCount = await testDb.user.count({ where: { phone } })
  assert.equal(userCount, 0, 'Failed OTP attempt must NOT create any user in the database')
  assert.equal(step2Res.headers.get('set-cookie'), null, 'No auth cookie on failed OTP')
})

test('4. Valid OTP in Step 2 creates the user with isVerified: true and sets auth_token cookie', async () => {
  const phone = randomPhone()
  let capturedOtp = null

  setCloudSmsMockTransport(async (payload) => {
    const match = payload.sms.match(/(\d{6})/)
    if (match) capturedOtp = match[1]
    return { success: true, code: 1, messageId: 'mock-sms-step2-success' }
  })

  // 1. Step 1: Request OTP
  const step1Res = await postRegister(
    makeRequest({
      name: 'Valid User',
      phone,
      password: 'StrongPassword123!',
    })
  )
  assert.equal(step1Res.status, 200)

  // Verify 0 users before OTP
  let user = await testDb.user.findFirst({ where: { phone } })
  assert.equal(user, null)

  // 2. Step 2: Submit with correct OTP code
  const step2Res = await postRegister(
    makeRequest({
      name: 'Valid User',
      phone,
      password: 'StrongPassword123!',
      otpCode: capturedOtp,
    })
  )
  assert.equal(step2Res.status, 201, 'Successful registration must return HTTP 201')

  const step2Body = await step2Res.json()
  assert.equal(step2Body.success, true)
  assert.equal(step2Body.data.user.phone, phone)
  assert.equal(step2Body.data.user.name, 'Valid User')
  assert.equal(step2Body.data.requiresVerification, false)
  assert.ok(step2Body.data.token, 'JWT token must be provided')

  // Verify auth_token cookie is set
  const cookie = step2Res.headers.get('set-cookie')
  assert.ok(cookie && cookie.includes('auth_token='), 'auth_token cookie must be set on successful verification')

  // Verify user in DB isVerified: true
  user = await testDb.user.findFirst({ where: { phone } })
  assert.ok(user, 'User record must exist in DB')
  assert.equal(user.isVerified, true, 'User must be marked isVerified: true')
  assert.equal(user.role, 'customer')
})

test('5. Duplicate phone registration is blocked with HTTP 409 after user is verified', async () => {
  const phone = randomPhone()

  // Create already-registered verified user
  await testDb.user.create({
    data: {
      name: 'Existing Customer',
      phone,
      password: 'HashedPassword123!',
      role: 'customer',
      isVerified: true,
    },
  })

  const req = makeRequest({
    name: 'Impostor',
    phone,
    password: 'AnotherPassword123!',
  })
  const res = await postRegister(req)
  assert.equal(res.status, 409, 'Duplicate phone registration must return HTTP 409')
  const body = await res.json()
  assert.equal(body.success, false)
  assert.match(body.error, /already exists/i)
})

test('6. Unclaimed guest profile claim flow works seamlessly via Step 1 and Step 2', async () => {
  const phone = randomPhone()

  // Create unclaimed guest profile
  const guestUser = await testDb.user.create({
    data: {
      name: 'Guest Customer',
      phone,
      password: null, // Unclaimed guest
      role: 'customer',
      isVerified: true,
    },
  })

  let capturedOtp = null
  setCloudSmsMockTransport(async (payload) => {
    const match = payload.sms.match(/(\d{6})/)
    if (match) capturedOtp = match[1]
    return { success: true, code: 1, messageId: 'mock-sms-claim' }
  })

  // Step 1: Register request for guest profile
  const step1Res = await postRegister(
    makeRequest({
      name: 'Claimed Customer Name',
      phone,
      password: 'NewClaimPassword123!',
    })
  )
  assert.equal(step1Res.status, 200)
  const step1Body = await step1Res.json()
  assert.equal(step1Body.success, true)
  assert.equal(step1Body.data.requiresOtp, true)
  assert.equal(step1Body.data.claimProfile, true)

  // Step 2: Submit with OTP code
  const step2Res = await postRegister(
    makeRequest({
      name: 'Claimed Customer Name',
      phone,
      password: 'NewClaimPassword123!',
      otpCode: capturedOtp,
    })
  )
  assert.equal(step2Res.status, 200, 'Claiming profile returns HTTP 200')
  const step2Body = await step2Res.json()
  assert.equal(step2Body.success, true)
  assert.equal(step2Body.data.claimed, true)

  // Verify DB record is updated with password and isVerified: true
  const updatedUser = await testDb.user.findUnique({ where: { id: guestUser.id } })
  assert.ok(updatedUser.password !== null, 'Password must be set')
  assert.equal(updatedUser.name, 'Claimed Customer Name')
  assert.equal(updatedUser.isVerified, true)
})

test('7. Email-only registration flow creates user and issues auth_token cookie', async () => {
  const email = `emailonly-${Date.now()}@example.com`

  const req = makeRequest({
    name: 'Email Only User',
    email,
    password: 'EmailPassword123!',
  })
  const res = await postRegister(req)
  assert.equal(res.status, 201)

  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.data.user.email, email)
  assert.equal(body.data.user.phone, null)
  assert.ok(body.data.token)

  const cookie = res.headers.get('set-cookie')
  assert.ok(cookie && cookie.includes('auth_token='))

  const user = await testDb.user.findUnique({ where: { email } })
  assert.ok(user)
  assert.equal(user.phone, null)
})
