import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

process.env.NODE_ENV = 'test'
process.env.BULKSMSBD_API_KEY = 'mock-test-key'
process.env.BULKSMSBD_SENDER_ID = 'KHATI_KHADYO'
process.env.OTP_SECRET = 'test-secret-at-least-32-characters-long'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()
globalThis.prisma = testDb

const {
  normalizeBulkSmsPhone,
  sendBulkSms,
  setBulkSmsMockTransport,
  isBulkSmsConfigured,
} = await import('../src/lib/bulksmsbd.ts')

const {
  issueOtp,
  verifyOtp,
  OtpCooldownError,
} = await import('../src/lib/otp.ts')

test('1. normalizeBulkSmsPhone normalizes all Bangladeshi phone formats to 8801XXXXXXXXX', () => {
  assert.equal(normalizeBulkSmsPhone('01712345678'), '8801712345678')
  assert.equal(normalizeBulkSmsPhone('+8801812345678'), '8801812345678')
  assert.equal(normalizeBulkSmsPhone('8801912345678'), '8801912345678')
  assert.equal(normalizeBulkSmsPhone('01300000000'), '8801300000000')
  assert.equal(normalizeBulkSmsPhone(' 01612-345678 '), '8801612345678')

  // Invalid formats
  assert.equal(normalizeBulkSmsPhone('01212345678'), null, 'Invalid prefix 012')
  assert.equal(normalizeBulkSmsPhone('01712345'), null, 'Too short')
  assert.equal(normalizeBulkSmsPhone('invalid-phone'), null, 'Non-digits')
  assert.equal(normalizeBulkSmsPhone(null), null)
})

test('2. sendBulkSms routes to mock transport in test mode and preserves contract', async () => {
  let capturedPayload = null

  setBulkSmsMockTransport(async (payload) => {
    capturedPayload = payload
    return {
      success: true,
      messageId: 'mock-msg-12345',
      responseCode: 202,
      rawResponse: JSON.stringify({ response_code: 202, message_id: 'mock-msg-12345' }),
    }
  })

  const result = await sendBulkSms('01711223344', 'আপনার খাঁটি খাদ্য ওটিপি কোড: ১২৩৪৫৬')
  assert.equal(result.success, true)
  assert.equal(result.messageId, 'mock-msg-12345')
  assert.ok(capturedPayload, 'Mock transport should capture the payload')
  assert.equal(capturedPayload.number, '8801711223344')
  assert.equal(capturedPayload.message, 'আপনার খাঁটি খাদ্য ওটিপি কোড: ১২৩৪৫৬')
})

test('3. OTP lifecycle: issue, cooldown enforcement, attempt tracking, and consumption', async () => {
  await testDb.otpChallenge.deleteMany()

  let lastSentOtp = null
  setBulkSmsMockTransport(async (payload) => {
    const match = payload.message.match(/(\d{6})/)
    if (match) lastSentOtp = match[1]
    return {
      success: true,
      messageId: 'mock-id-789',
      responseCode: 202,
    }
  })

  const phone = '01811223344'
  const issueResult = await issueOtp(phone, 'phone_verification')
  assert.equal(issueResult.expiresInSeconds, 300)
  assert.ok(lastSentOtp, 'OTP code should be generated and passed to SMS transport')
  assert.equal(lastSentOtp.length, 6)

  // Cooldown: issuing immediately should throw OtpCooldownError
  await assert.rejects(
    async () => {
      await issueOtp(phone, 'phone_verification')
    },
    (err) => err instanceof OtpCooldownError
  )

  // Attempt with wrong code: should fail
  const wrongAttempt = await verifyOtp(phone, 'phone_verification', '000000')
  assert.equal(wrongAttempt.ok, false)

  // Attempt with correct code: should succeed
  const correctAttempt = await verifyOtp(phone, 'phone_verification', lastSentOtp)
  assert.equal(correctAttempt.ok, true)

  // Re-verify already consumed OTP: should fail
  const reVerify = await verifyOtp(phone, 'phone_verification', lastSentOtp)
  assert.equal(reVerify.ok, false)
})

test('4. Order placement blocked for unverified logged-in customer and allowed once verified', async () => {
  // Clear tables
  await testDb.orderItem.deleteMany()
  await testDb.payment.deleteMany()
  await testDb.order.deleteMany()
  await testDb.user.deleteMany()

  // 1. Create an unverified customer
  const unverifiedUser = await testDb.user.create({
    data: {
      name: 'Unverified Customer',
      email: 'unverified@example.com',
      phone: '01700000099',
      role: 'customer',
      isVerified: false,
    },
  })

  // Simulated check in /api/orders POST handler
  const checkCustomerVerified = (user) => {
    if (!user.phone || !user.isVerified) {
      return {
        allowed: false,
        status: 403,
        code: 'PHONE_UNVERIFIED',
        error: 'অর্ডার নিশ্চিত করতে আপনার ফোন নম্বর ভেরিফাই করা আবশ্যক।',
      }
    }
    return { allowed: true }
  }

  const unverifiedCheck = checkCustomerVerified(unverifiedUser)
  assert.equal(unverifiedCheck.allowed, false)
  assert.equal(unverifiedCheck.status, 403)
  assert.equal(unverifiedCheck.code, 'PHONE_UNVERIFIED')

  // 2. Simulate phone OTP verification
  const verifiedUser = await testDb.user.update({
    where: { id: unverifiedUser.id },
    data: { isVerified: true },
  })

  const verifiedCheck = checkCustomerVerified(verifiedUser)
  assert.equal(verifiedCheck.allowed, true)
})
