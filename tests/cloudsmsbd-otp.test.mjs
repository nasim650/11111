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

const {
  normalizeCloudSmsPhone,
  detectIsUnicode,
  maskPhoneNumber,
  isCloudSmsConfigured,
  setCloudSmsMockTransport,
  parseCloudSmsResponse,
  sendCloudSms,
  getSafeCloudSmsErrorMessage,
  CLOUD_SMS_SAFE_ERRORS,
  CloudSmsError,
} = await import('../src/lib/cloudsmsbd.ts')

const {
  issueOtp,
  verifyOtp,
  getSmsProvider,
  ensureOtpDeliveryConfigured,
  getSafeOtpDiagnostics,
  OtpCooldownError,
  OtpDeliveryUnavailableError,
} = await import('../src/lib/otp.ts')

const { generateToken } = await import('../src/lib/auth.ts')
const { POST: postGuestPhoneSend } = await import('../src/app/api/auth/guest-phone/send/route.ts')
const { POST: postGuestPhoneVerify } = await import('../src/app/api/auth/guest-phone/verify/route.ts')
const { POST: postForgotPassword } = await import('../src/app/api/auth/forgot-password/route.ts')
const { POST: postResetPassword } = await import('../src/app/api/auth/reset-password/route.ts')
const { POST: postVerifyPhoneSend } = await import('../src/app/api/auth/verify-phone/send/route.ts')
const { POST: postVerifyPhone } = await import('../src/app/api/auth/verify-phone/route.ts')
const { GET: getSmsDiagnostics } = await import('../src/app/api/admin/sms-diagnostics/route.ts')

function makeNextRequest(url, { method = 'POST', headers = {}, body = null } = {}) {
  const init = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }
  if (body) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  return new Request(url, init)
}

test('1. 01XXXXXXXXX -> 8801XXXXXXXXX phone normalization', () => {
  assert.equal(normalizeCloudSmsPhone('01712345678'), '8801712345678')
  assert.equal(normalizeCloudSmsPhone('01812345678'), '8801812345678')
  assert.equal(normalizeCloudSmsPhone('01300000000'), '8801300000000')
  assert.equal(normalizeCloudSmsPhone(' 01912-345678 '), '8801912345678')
})

test('2. +8801XXXXXXXXX -> 8801XXXXXXXXX phone normalization', () => {
  assert.equal(normalizeCloudSmsPhone('+8801712345678'), '8801712345678')
  assert.equal(normalizeCloudSmsPhone('+8801812345678'), '8801812345678')
  assert.equal(normalizeCloudSmsPhone('8801912345678'), '8801912345678')
  assert.equal(normalizeCloudSmsPhone(' +8801612-345678 '), '8801612345678')
})

test('3. Invalid phone inputs are safely rejected (returns null)', () => {
  assert.equal(normalizeCloudSmsPhone('01212345678'), null, 'Prefix 012 is invalid')
  assert.equal(normalizeCloudSmsPhone('01012345678'), null, 'Prefix 010 is invalid')
  assert.equal(normalizeCloudSmsPhone('01712345'), null, 'Too short')
  assert.equal(normalizeCloudSmsPhone('0171234567890'), null, 'Too long')
  assert.equal(normalizeCloudSmsPhone('invalid-phone-number'), null, 'Non-digits')
  assert.equal(normalizeCloudSmsPhone(''), null, 'Empty string')
  assert.equal(normalizeCloudSmsPhone(null), null, 'Null input')
  assert.equal(normalizeCloudSmsPhone(undefined), null, 'Undefined input')
})

test('4. English OTP payload uses IsUnicode=2', async () => {
  const englishMessage = 'Your Khati Khadyo code to verify your phone number is 123456. It expires in 5 minutes.'
  assert.equal(detectIsUnicode(englishMessage), 2, 'English text must map to IsUnicode=2')

  let capturedPayload = null
  setCloudSmsMockTransport(async (payload) => {
    capturedPayload = payload
    return { success: true, code: 1, messageId: 'msg-en-1' }
  })

  await sendCloudSms({ to: '01711223344', message: englishMessage })
  assert.ok(capturedPayload, 'Mock transport should capture the payload')
  assert.equal(capturedPayload.IsUnicode, 2, 'IsUnicode must be 2 for English')
  assert.equal(capturedPayload.number, '8801711223344')
  assert.equal(capturedPayload.ApiKey, 'test-cloudsms-api-key-secret-12345')
  assert.equal(capturedPayload.SenderID, 'KHATIKHADYO')
})

test('5. Bangla payload uses IsUnicode=1', async () => {
  const banglaMessage = 'আপনার খাঁটি খাদ্য ভেরিফিকেশন ওটিপি কোড হলো: ১২৩৪৫৬'
  assert.equal(detectIsUnicode(banglaMessage), 1, 'Bangla text must map to IsUnicode=1')

  let capturedPayload = null
  setCloudSmsMockTransport(async (payload) => {
    capturedPayload = payload
    return { success: true, code: 1, messageId: 'msg-bn-1' }
  })

  await sendCloudSms({ to: '01811223344', message: banglaMessage })
  assert.ok(capturedPayload, 'Mock transport should capture the payload')
  assert.equal(capturedPayload.IsUnicode, 1, 'IsUnicode must be 1 for Bangla')
  assert.equal(capturedPayload.number, '8801811223344')
})

test('6. Success code 1 is accepted across response formats', () => {
  // Plain text '1'
  const res1 = parseCloudSmsResponse('1')
  assert.equal(res1.success, true)
  assert.equal(res1.code, 1)

  // Plain text with message '1:SMS Submitted'
  const res2 = parseCloudSmsResponse('1:SMS Submitted')
  assert.equal(res2.success, true)
  assert.equal(res2.code, 1)

  // JSON format with { code: 1 }
  const res3 = parseCloudSmsResponse('{"code": 1, "message_id": "cld-9988"}')
  assert.equal(res3.success, true)
  assert.equal(res3.code, 1)
  assert.equal(res3.messageId, 'cld-9988')

  // JSON format with { status: 1 }
  const res4 = parseCloudSmsResponse('{"status": 1, "message": "Success"}')
  assert.equal(res4.success, true)
  assert.equal(res4.code, 1)

  // JSON format with { ErrorCode: 1 }
  const res5 = parseCloudSmsResponse('{"ErrorCode": 1, "id": "tx-123"}')
  assert.equal(res5.success, true)
  assert.equal(res5.code, 1)
  assert.equal(res5.messageId, 'tx-123')
})

test('7. Provider error codes (2, 3, 4, 5, 6, 7, 10, 11, 101, 405) map to safe user-facing errors', () => {
  const codesToTest = [2, 3, 4, 5, 6, 7, 10, 11, 101, 405]

  for (const code of codesToTest) {
    assert.throws(
      () => parseCloudSmsResponse(JSON.stringify({ code })),
      (err) => {
        assert.ok(err instanceof CloudSmsError)
        assert.equal(err.code, code)
        assert.ok(err.safeMessage, `Safe message should exist for code ${code}`)
        // Crucial security invariant: never expose raw secrets or internal balance in safeMessage
        assert.doesNotMatch(err.safeMessage, /secret|ApiKey|password|balance|BDT/i)
        return true
      }
    )
  }

  // Verify safe messages directly
  assert.equal(getSafeCloudSmsErrorMessage(4), 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন')
  assert.equal(getSafeCloudSmsErrorMessage(6), 'এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ')
  assert.equal(getSafeCloudSmsErrorMessage(11), 'অতিরিক্ত অনুরোধের কারণে এসএমএস সাময়িকভাবে স্থগিত। কিছুক্ষণ পর চেষ্টা করুন')
  assert.equal(getSafeCloudSmsErrorMessage(101), 'এসএমএস গেটওয়ে সাময়িক বিভ্রাটে রয়েছে')
  assert.equal(getSafeCloudSmsErrorMessage(9999), 'এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।')
})

test('8. API key or sender ID absent blocks send and throws clear error', async () => {
  const originalKey = process.env.CLOUDSMSBD_API_KEY
  const originalSender = process.env.CLOUDSMSBD_SENDER_ID

  try {
    // 1. Missing API Key
    process.env.CLOUDSMSBD_API_KEY = ''
    assert.equal(isCloudSmsConfigured(), false)
    await assert.rejects(
      async () => sendCloudSms({ to: '01711223344', message: 'test' }),
      (err) => err instanceof CloudSmsError && err.code === 2
    )
    assert.throws(
      () => ensureOtpDeliveryConfigured(),
      (err) => err instanceof OtpDeliveryUnavailableError
    )

    // 2. Missing Sender ID
    process.env.CLOUDSMSBD_API_KEY = originalKey
    process.env.CLOUDSMSBD_SENDER_ID = '   '
    assert.equal(isCloudSmsConfigured(), false)
    await assert.rejects(
      async () => sendCloudSms({ to: '01711223344', message: 'test' }),
      (err) => err instanceof CloudSmsError && err.code === 2
    )
    assert.throws(
      () => ensureOtpDeliveryConfigured(),
      (err) => err instanceof OtpDeliveryUnavailableError
    )
  } finally {
    process.env.CLOUDSMSBD_API_KEY = originalKey
    process.env.CLOUDSMSBD_SENDER_ID = originalSender
  }
})

test('9. Provider request failure immediately consumes and invalidates OTP challenge', async () => {
  await testDb.otpChallenge.deleteMany()

  // Simulate provider transport failure
  setCloudSmsMockTransport(async () => {
    throw new CloudSmsError('Network timeout to Cloud SMS BD gateway', 101, 'এসএমএস গেটওয়ে সাময়িক বিভ্রাটে রয়েছে')
  })

  const testPhone = '01722334455'

  // Attempting to issue OTP must throw OtpDeliveryUnavailableError
  await assert.rejects(
    async () => issueOtp(testPhone, 'phone_verification'),
    (err) => err instanceof OtpDeliveryUnavailableError
  )

  // Verify the OTP challenge in DB was consumed/invalidated
  const challenges = await testDb.otpChallenge.findMany({
    where: { identifier: testPhone, purpose: 'phone_verification' },
  })
  assert.equal(challenges.length, 1, 'One challenge was recorded')
  assert.ok(challenges[0].consumedAt !== null, 'Failed delivery challenge MUST be consumed immediately')

  // Verification with any code must fail because challenge is consumed
  const verifyAttempt = await verifyOtp(testPhone, 'phone_verification', '123456')
  assert.equal(verifyAttempt.ok, false)
  assert.equal(verifyAttempt.error, 'This code is invalid or has expired')
})

test('10. No API key, OTP code, or full unmasked phone leak in logs or diagnostic responses', () => {
  // Test masking helper
  const masked1 = maskPhoneNumber('8801712345678')
  assert.equal(masked1, '88017****5678')
  assert.doesNotMatch(masked1, /8801712345678/)

  const masked2 = maskPhoneNumber('01712345678')
  assert.equal(masked2, '01712****5678')

  // Test diagnostic response
  const diagnostics = getSafeOtpDiagnostics()
  assert.equal(diagnostics.providerName, 'cloudsmsbd')
  assert.equal(diagnostics.providerConfigured, true)
  assert.equal(diagnostics.senderIdConfigured, true)
  assert.equal(diagnostics.otpSecretConfigured, true)

  const serialized = JSON.stringify(diagnostics)
  assert.doesNotMatch(serialized, /test-cloudsms-api-key-secret-12345/)
  assert.doesNotMatch(serialized, /KHATIKHADYO/)
  assert.doesNotMatch(serialized, /test-secret-at-least-32-characters-long/)
})

test('11. Existing registered-user OTP flow works end-to-end with Cloud SMS BD adapter', async () => {
  await testDb.otpChallenge.deleteMany()
  await testDb.orderItem.deleteMany()
  await testDb.payment.deleteMany()
  await testDb.order.deleteMany()
  await testDb.user.deleteMany()

  const user = await testDb.user.create({
    data: {
      name: 'Registered User',
      email: 'reguser@example.com',
      phone: '01811223399',
      role: 'customer',
      isVerified: false,
    },
  })

  const token = await generateToken(user.id, user.sessionVersion)

  let capturedOtp = null
  setCloudSmsMockTransport(async (payload) => {
    const match = payload.sms.match(/(\d{6})/)
    if (match) capturedOtp = match[1]
    return { success: true, code: 1, messageId: 'reg-msg-1' }
  })

  // 1. Send OTP
  const sendReq = makeNextRequest('http://localhost:3000/api/auth/verify-phone/send', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const sendRes = await postVerifyPhoneSend(sendReq)
  assert.equal(sendRes.status, 200)
  const sendData = await sendRes.json()
  assert.equal(sendData.success, true)
  assert.ok(capturedOtp, 'OTP must be captured via mock transport')

  // 2. Verify OTP
  const verifyReq = makeNextRequest('http://localhost:3000/api/auth/verify-phone', {
    headers: { Authorization: `Bearer ${token}` },
    body: { code: capturedOtp },
  })
  const verifyRes = await postVerifyPhone(verifyReq)
  assert.equal(verifyRes.status, 200)
  const verifyData = await verifyRes.json()
  assert.equal(verifyData.success, true)
  assert.equal(verifyData.data.verified, true)

  const updatedUser = await testDb.user.findUnique({ where: { id: user.id } })
  assert.equal(updatedUser.isVerified, true, 'User is now verified')
})

test('12. Existing guest-checkout OTP flow works end-to-end with Cloud SMS BD adapter', async () => {
  await testDb.otpChallenge.deleteMany()

  const guestPhone = '01911223388'
  let capturedOtp = null
  setCloudSmsMockTransport(async (payload) => {
    const match = payload.sms.match(/(\d{6})/)
    if (match) capturedOtp = match[1]
    return { success: true, code: 1, messageId: 'guest-msg-1' }
  })

  // 1. Send Guest OTP
  const sendReq = makeNextRequest('http://localhost:3000/api/auth/guest-phone/send', {
    body: { phone: guestPhone },
  })
  const sendRes = await postGuestPhoneSend(sendReq)
  assert.equal(sendRes.status, 200)
  const sendData = await sendRes.json()
  assert.equal(sendData.success, true)
  assert.equal(sendData.data.phone, guestPhone)
  assert.ok(capturedOtp, 'OTP must be delivered to guest')

  // 2. Verify Guest OTP
  const verifyReq = makeNextRequest('http://localhost:3000/api/auth/guest-phone/verify', {
    body: { phone: guestPhone, code: capturedOtp },
  })
  const verifyRes = await postGuestPhoneVerify(verifyReq)
  assert.equal(verifyRes.status, 200)
  const verifyData = await verifyRes.json()
  assert.equal(verifyData.success, true)
  assert.ok(verifyData.data.checkoutProof, 'Checkout proof generated')
  assert.equal(verifyData.data.phone, guestPhone)
})

test('13. Password reset OTP flow works end-to-end with Cloud SMS BD adapter', async () => {
  await testDb.otpChallenge.deleteMany()
  await testDb.user.deleteMany()

  const user = await testDb.user.create({
    data: {
      name: 'Reset Password User',
      email: 'resetpwd@example.com',
      phone: '01799887766',
      password: 'OldHashedPassword123!',
      role: 'customer',
      sessionVersion: 1,
    },
  })

  let capturedOtp = null
  setCloudSmsMockTransport(async (payload) => {
    const match = payload.sms.match(/(\d{6})/)
    if (match) capturedOtp = match[1]
    return { success: true, code: 1, messageId: 'reset-msg-1' }
  })

  // 1. Request Forgot Password OTP
  const forgotReq = makeNextRequest('http://localhost:3000/api/auth/forgot-password', {
    body: { phone: user.phone },
  })
  const forgotRes = await postForgotPassword(forgotReq)
  assert.equal(forgotRes.status, 200)
  const forgotData = await forgotRes.json()
  assert.equal(forgotData.success, true)
  assert.ok(capturedOtp, 'OTP captured for password reset')

  // 2. Reset password with OTP
  const newPassword = 'NewSecurePassword2026!#'
  const resetReq = makeNextRequest('http://localhost:3000/api/auth/reset-password', {
    body: { phone: user.phone, code: capturedOtp, password: newPassword },
  })
  const resetRes = await postResetPassword(resetReq)
  assert.equal(resetRes.status, 200)
  const resetData = await resetRes.json()
  assert.equal(resetData.success, true)

  const updatedUser = await testDb.user.findUnique({ where: { id: user.id } })
  assert.notEqual(updatedUser.password, 'OldHashedPassword123!')
  assert.equal(updatedUser.sessionVersion, 2, 'sessionVersion incremented to invalidate existing logins')
})

test('14. Admin SMS diagnostics endpoint enforces authentication and returns safe metadata', async () => {
  // Non-authenticated request -> 401
  const unauthReq = makeNextRequest('http://localhost:3000/api/admin/sms-diagnostics', { method: 'GET' })
  const unauthRes = await getSmsDiagnostics(unauthReq)
  assert.equal(unauthRes.status, 401)

  // Customer user token -> 401 Unauthorized
  const customerUser = await testDb.user.create({
    data: {
      name: 'Customer Diagnostic Test',
      email: 'customer_diag@example.com',
      phone: '01700112244',
      role: 'customer',
      sessionVersion: 1,
    },
  })
  const customerToken = await generateToken(customerUser.id, customerUser.sessionVersion)
  const customerReq = makeNextRequest('http://localhost:3000/api/admin/sms-diagnostics', {
    method: 'GET',
    headers: { Authorization: `Bearer ${customerToken}` },
  })
  const customerRes = await getSmsDiagnostics(customerReq)
  assert.equal(customerRes.status, 401)

  // Admin user token -> 200 with safe diagnostics
  const adminUser = await testDb.user.create({
    data: {
      name: 'Admin Diagnostic Test',
      email: 'admin_diag@example.com',
      phone: '01700112233',
      role: 'admin',
      sessionVersion: 1,
    },
  })
  const adminToken = await generateToken(adminUser.id, adminUser.sessionVersion)
  const adminReq = makeNextRequest('http://localhost:3000/api/admin/sms-diagnostics', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const adminRes = await getSmsDiagnostics(adminReq)
  assert.equal(adminRes.status, 200)
  const adminData = await adminRes.json()
  assert.equal(adminData.success, true)
  assert.equal(adminData.data.providerName, 'cloudsmsbd')
  assert.equal(adminData.data.providerConfigured, true)
  assert.equal(adminData.data.senderIdConfigured, true)
  assert.equal(adminData.data.otpSecretConfigured, true)
  assert.equal(adminData.data.ApiKey, undefined)
  assert.equal(adminData.data.secret, undefined)
})

test('15. Missing OTP_SECRET or Cloud SMS BD configuration returns HTTP 503 with readable Bangla message and no false success', async () => {
  const origKey = process.env.CLOUDSMSBD_API_KEY
  const origSecret = process.env.OTP_SECRET

  try {
    // 1. Missing Cloud SMS BD API key
    process.env.CLOUDSMSBD_API_KEY = ''

    // Guest phone send
    const guestReq = makeNextRequest('http://localhost:3000/api/auth/guest-phone/send', {
      body: { phone: '01711223344' },
    })
    const guestRes = await postGuestPhoneSend(guestReq)
    assert.equal(guestRes.status, 503)
    const guestData = await guestRes.json()
    assert.equal(guestData.success, false)
    assert.match(guestData.error, /এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ/)

    // Forgot password send (even if user does not exist, must not report false success)
    const forgotReq = makeNextRequest('http://localhost:3000/api/auth/forgot-password', {
      body: { phone: '01799881122' },
    })
    const forgotRes = await postForgotPassword(forgotReq)
    assert.equal(forgotRes.status, 503)
    const forgotData = await forgotRes.json()
    assert.equal(forgotData.success, false)
    assert.match(forgotData.error, /এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ/)

    // 2. Restore key, but break OTP_SECRET (< 32 chars)
    process.env.CLOUDSMSBD_API_KEY = origKey
    process.env.OTP_SECRET = 'short'

    const guestReq2 = makeNextRequest('http://localhost:3000/api/auth/guest-phone/send', {
      body: { phone: '01711223344' },
    })
    const guestRes2 = await postGuestPhoneSend(guestReq2)
    assert.equal(guestRes2.status, 503)
    const guestData2 = await guestRes2.json()
    assert.equal(guestData2.success, false)
    assert.match(guestData2.error, /এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ/)
  } finally {
    process.env.CLOUDSMSBD_API_KEY = origKey
    process.env.OTP_SECRET = origSecret
  }
})

