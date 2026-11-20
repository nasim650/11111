import crypto from 'crypto'
import { db } from '@/lib/db'
import { normalizePhone } from '@/lib/validation'
import { sendBulkSms, isBulkSmsConfigured, BulkSmsError } from '@/lib/bulksmsbd'
import { sendCloudSms, isCloudSmsConfigured, CloudSmsError } from '@/lib/cloudsmsbd'

export type OtpPurpose = 'password_reset' | 'phone_verification'
export type SmsProviderName = 'cloudsmsbd' | 'bulksmsbd' | 'generic'

const OTP_TTL_MS = 5 * 60 * 1000
const OTP_RESEND_COOLDOWN_MS = 60 * 1000
const MAX_OTP_ATTEMPTS = 5

export class OtpDeliveryUnavailableError extends Error {
  constructor(message = 'এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।') {
    super(message)
    this.name = 'OtpDeliveryUnavailableError'
  }
}

export class OtpCooldownError extends Error {
  readonly retryAfter: number

  constructor(retryAfter: number) {
    super(`Please wait ${retryAfter} seconds before requesting another code`)
    this.name = 'OtpCooldownError'
    this.retryAfter = retryAfter
  }
}

function getOtpSecret(): string {
  const secret = process.env.OTP_SECRET
  if (!secret || secret.length < 32) {
    throw new OtpDeliveryUnavailableError('এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।')
  }
  return secret
}

/**
 * Resolves the configured SMS provider name.
 * Throws a clear configuration error if an unknown provider name is supplied.
 */
export function getSmsProvider(): SmsProviderName | null {
  const envProvider = process.env.SMS_PROVIDER?.trim().toLowerCase()
  if (envProvider) {
    if (envProvider === 'cloudsmsbd') return 'cloudsmsbd'
    if (envProvider === 'bulksmsbd') return 'bulksmsbd'
    if (envProvider === 'generic') return 'generic'
    throw new OtpDeliveryUnavailableError(`Unknown SMS provider configured: ${process.env.SMS_PROVIDER}`)
  }

  // Backward compatibility when SMS_PROVIDER is not explicitly specified:
  if (isCloudSmsConfigured()) return 'cloudsmsbd'
  if (isBulkSmsConfigured()) return 'bulksmsbd'
  if (process.env.SMS_GATEWAY_URL && process.env.SMS_GATEWAY_URL.trim()) return 'generic'

  return null
}

/**
 * Validates that OTP generation and SMS delivery prerequisites are met before creating challenges.
 */
export function ensureOtpDeliveryConfigured(): void {
  getOtpSecret()

  const envProvider = process.env.SMS_PROVIDER?.trim().toLowerCase()
  if (envProvider) {
    if (envProvider === 'cloudsmsbd') {
      if (!isCloudSmsConfigured()) {
        throw new OtpDeliveryUnavailableError('এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।')
      }
      return
    }
    if (envProvider === 'bulksmsbd') {
      if (!isBulkSmsConfigured()) {
        throw new OtpDeliveryUnavailableError('এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।')
      }
      return
    }
    if (envProvider === 'generic') {
      if (!process.env.SMS_GATEWAY_URL?.trim()) {
        throw new OtpDeliveryUnavailableError('এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।')
      }
      return
    }
    throw new OtpDeliveryUnavailableError(`Unknown SMS provider configured: ${process.env.SMS_PROVIDER}`)
  }

  // In test mode without explicit SMS_PROVIDER, allowed without live SMS provider
  if (process.env.NODE_ENV === 'test') {
    return
  }

  const hasCloudSms = isCloudSmsConfigured()
  const hasBulkSms = isBulkSmsConfigured()
  const hasGenericGateway = Boolean(process.env.SMS_GATEWAY_URL && process.env.SMS_GATEWAY_URL.trim())

  if (!hasCloudSms && !hasBulkSms && !hasGenericGateway) {
    throw new OtpDeliveryUnavailableError('এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।')
  }
}

function hashOtp(identifier: string, purpose: OtpPurpose, code: string): string {
  return crypto
    .createHmac('sha256', getOtpSecret())
    .update(`${identifier}:${purpose}:${code}`)
    .digest('hex')
}

function secureHashMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'hex')
  const receivedBuffer = Buffer.from(received, 'hex')
  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}

function createCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function parseOtpPhone(value: unknown): string | null {
  const phone = normalizePhone(value)
  return phone && /^01\d{9}$/.test(phone) ? phone : null
}

/**
 * Dispatches the OTP SMS using the selected provider.
 * Under NO circumstances does it automatically fall back to another provider upon failure,
 * which strictly prevents sending duplicate or confusing OTP messages.
 */
async function deliverSmsOtp(phone: string, purpose: OtpPurpose, code: string): Promise<void> {
  const action = purpose === 'password_reset' ? 'reset your password' : 'verify your phone number'
  const message = `Your Khati Khadyo code to ${action} is ${code}. It expires in 5 minutes. Do not share this code.`

  const provider = getSmsProvider()

  // 1. Cloud SMS BD adapter (Official server-only contract)
  if (provider === 'cloudsmsbd') {
    try {
      await sendCloudSms({ to: phone, message })
      return
    } catch (error) {
      if (error instanceof CloudSmsError) {
        throw new OtpDeliveryUnavailableError(error.safeMessage || 'এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ।')
      }
      throw new OtpDeliveryUnavailableError('এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ।')
    }
  }

  // 2. BulkSMSBD adapter (Backward compatible)
  if (provider === 'bulksmsbd') {
    try {
      await sendBulkSms({ to: phone, message })
      return
    } catch (error) {
      if (error instanceof BulkSmsError) {
        throw new OtpDeliveryUnavailableError(error.message)
      }
      throw new OtpDeliveryUnavailableError('Unable to deliver the verification code right now')
    }
  }

  // 3. Generic SMS Gateway Fallback
  if (provider === 'generic') {
    const endpoint = process.env.SMS_GATEWAY_URL
    if (!endpoint) {
      throw new OtpDeliveryUnavailableError('SMS OTP delivery has not been configured')
    }
    const token = process.env.SMS_GATEWAY_TOKEN
    const sender = process.env.SMS_SENDER_ID
    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: phone,
          from: sender,
          message,
        }),
      })
    } catch {
      throw new OtpDeliveryUnavailableError('Unable to reach the SMS service right now')
    }

    if (!response.ok) {
      throw new OtpDeliveryUnavailableError('Unable to deliver the verification code right now')
    }
    return
  }

  // In test mode without explicit provider, allow mock passthrough
  if (process.env.NODE_ENV === 'test' && !process.env.SMS_PROVIDER) {
    return
  }

  throw new OtpDeliveryUnavailableError('এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।')
}

export async function issueOtp(phone: string, purpose: OtpPurpose): Promise<{ expiresInSeconds: number }> {
  // Validate configuration before invalidating a previously sent code.
  ensureOtpDeliveryConfigured()

  const now = new Date()
  const latest = await db.otpChallenge.findFirst({
    where: { identifier: phone, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (latest && now.getTime() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now.getTime() - latest.createdAt.getTime())) / 1000)
    throw new OtpCooldownError(retryAfter)
  }

  const code = createCode()
  const challenge = await db.$transaction(async (tx) => {
    await tx.otpChallenge.updateMany({
      where: { identifier: phone, purpose, consumedAt: null },
      data: { consumedAt: now },
    })
    return tx.otpChallenge.create({
      data: {
        identifier: phone,
        purpose,
        codeHash: hashOtp(phone, purpose, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      },
    })
  })

  try {
    await deliverSmsOtp(phone, purpose, code)
  } catch (error) {
    // A code that was never delivered must not be valid.
    await db.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } })
    throw error
  }

  return { expiresInSeconds: OTP_TTL_MS / 1000 }
}

export async function verifyOtp(phone: string, purpose: OtpPurpose, code: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return { ok: false, error: 'Enter the 6-digit code' }
  }

  const now = new Date()
  const challenge = await db.otpChallenge.findFirst({
    where: { identifier: phone, purpose, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  })
  if (!challenge) return { ok: false, error: 'This code is invalid or has expired' }

  if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
    await db.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } })
    return { ok: false, error: 'Too many invalid attempts. Request a new code.' }
  }

  const isValid = secureHashMatch(challenge.codeHash, hashOtp(phone, purpose, code))
  if (!isValid) {
    const attempts = challenge.attempts + 1
    await db.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts, ...(attempts >= MAX_OTP_ATTEMPTS ? { consumedAt: now } : {}) },
    })
    return {
      ok: false,
      error: attempts >= MAX_OTP_ATTEMPTS
        ? 'Too many invalid attempts. Request a new code.'
        : 'This code is invalid or has expired',
    }
  }

  const consumed = await db.otpChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: now },
  })
  return consumed.count === 1
    ? { ok: true }
    : { ok: false, error: 'This code has already been used' }
}

export interface SafeOtpDiagnostics {
  providerName: string
  providerConfigured: boolean
  senderIdConfigured: boolean
  otpSecretConfigured: boolean
}

/**
 * Returns safe diagnostic metadata for administrator panels or health checks.
 * NEVER leaks raw API keys, sender values, OTP codes, or secrets.
 */
export function getSafeOtpDiagnostics(): SafeOtpDiagnostics {
  let provider: SmsProviderName | null = null
  try {
    provider = getSmsProvider()
  } catch {
    provider = null
  }

  const otpSecret = process.env.OTP_SECRET
  const otpSecretConfigured = Boolean(otpSecret && otpSecret.length >= 32)

  let providerConfigured = false
  let senderIdConfigured = false

  if (provider === 'cloudsmsbd') {
    providerConfigured = Boolean(process.env.CLOUDSMSBD_API_KEY && process.env.CLOUDSMSBD_API_KEY.trim())
    senderIdConfigured = Boolean(process.env.CLOUDSMSBD_SENDER_ID && process.env.CLOUDSMSBD_SENDER_ID.trim())
  } else if (provider === 'bulksmsbd') {
    providerConfigured = Boolean(process.env.BULKSMSBD_API_KEY && process.env.BULKSMSBD_API_KEY.trim())
    senderIdConfigured = Boolean(process.env.BULKSMSBD_SENDER_ID && process.env.BULKSMSBD_SENDER_ID.trim())
  } else if (provider === 'generic') {
    providerConfigured = Boolean(process.env.SMS_GATEWAY_URL && process.env.SMS_GATEWAY_URL.trim())
    senderIdConfigured = Boolean(process.env.SMS_SENDER_ID && process.env.SMS_SENDER_ID.trim())
  }

  return {
    providerName: provider || 'none',
    providerConfigured,
    senderIdConfigured,
    otpSecretConfigured,
  }
}
