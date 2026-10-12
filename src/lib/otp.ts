import crypto from 'crypto'
import { db } from '@/lib/db'
import { normalizePhone } from '@/lib/validation'

export type OtpPurpose = 'password_reset' | 'phone_verification'

const OTP_TTL_MS = 5 * 60 * 1000
const OTP_RESEND_COOLDOWN_MS = 60 * 1000
const MAX_OTP_ATTEMPTS = 5

export class OtpDeliveryUnavailableError extends Error {}
export class OtpCooldownError extends Error {
  constructor(public readonly retryAfter: number) {
    super(`Please wait ${retryAfter} seconds before requesting another code`)
  }
}

function getOtpSecret(): string {
  const secret = process.env.OTP_SECRET
  if (!secret || secret.length < 32) {
    throw new OtpDeliveryUnavailableError('OTP service is not configured')
  }
  return secret
}

export function ensureOtpDeliveryConfigured(): void {
  getOtpSecret()
  if (!process.env.SMS_GATEWAY_URL) {
    throw new OtpDeliveryUnavailableError('SMS OTP delivery has not been configured')
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

async function deliverSmsOtp(phone: string, purpose: OtpPurpose, code: string): Promise<void> {
  const endpoint = process.env.SMS_GATEWAY_URL
  if (!endpoint) {
    throw new OtpDeliveryUnavailableError('SMS OTP delivery has not been configured')
  }

  const token = process.env.SMS_GATEWAY_TOKEN
  const sender = process.env.SMS_SENDER_ID
  const action = purpose === 'password_reset' ? 'reset your password' : 'verify your phone number'
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // Generic JSON adapter contract for the chosen Bangladesh SMS provider.
      // Do not log this payload: it includes the one-time code.
      body: JSON.stringify({
        to: phone,
        from: sender,
        message: `Your Khati Khadyo code to ${action} is ${code}. It expires in 5 minutes. Do not share this code.`,
      }),
    })
  } catch {
    throw new OtpDeliveryUnavailableError('Unable to reach the SMS service right now')
  }

  if (!response.ok) {
    throw new OtpDeliveryUnavailableError('Unable to deliver the verification code right now')
  }
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
