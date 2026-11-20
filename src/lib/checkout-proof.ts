import crypto from 'crypto'
import { normalizePhone } from '@/lib/validation'

const PROOF_TTL_MS = 15 * 60 * 1000 // 15 minutes validity for checkout proof

function getProofSecret(): string {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'khati-khadyo-checkout-proof-secret-fallback'
  return secret
}

/**
 * Creates a tamper-proof, time-limited proof that a phone number has been verified via OTP.
 */
export function createCheckoutProof(phone: string): string {
  const normalized = normalizePhone(phone)
  if (!normalized) throw new Error('Cannot create checkout proof for invalid phone')

  const timestamp = Date.now().toString()
  const payload = `${normalized}:${timestamp}`
  const signature = crypto
    .createHmac('sha256', getProofSecret())
    .update(payload)
    .digest('hex')

  const raw = `${payload}:${signature}`
  return Buffer.from(raw).toString('base64url')
}

/**
 * Verifies that a checkout proof was issued for the expected phone number and has not expired.
 */
export function verifyCheckoutProof(proof: unknown, expectedPhone: string): boolean {
  if (typeof proof !== 'string' || !proof.trim()) return false

  const normalizedExpected = normalizePhone(expectedPhone)
  if (!normalizedExpected) return false

  try {
    const raw = Buffer.from(proof, 'base64url').toString('utf-8')
    const parts = raw.split(':')
    if (parts.length !== 3) return false

    const [phone, timestampStr, receivedSig] = parts
    if (phone !== normalizedExpected) return false

    const timestamp = parseInt(timestampStr, 10)
    if (isNaN(timestamp)) return false

    const now = Date.now()
    if (now - timestamp > PROOF_TTL_MS || timestamp > now + 60_000) {
      return false // Expired or future timestamp
    }

    const payload = `${phone}:${timestampStr}`
    const expectedSig = crypto
      .createHmac('sha256', getProofSecret())
      .update(payload)
      .digest('hex')

    const expectedBuffer = Buffer.from(expectedSig, 'hex')
    const receivedBuffer = Buffer.from(receivedSig, 'hex')

    if (expectedBuffer.length !== receivedBuffer.length) return false
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  } catch {
    return false
  }
}
