/**
 * BulkSMSBD Server-Side Adapter
 * -----------------------------
 * Official REST API POST contract for BulkSMSBD (bulksmsbd.net / bulksmsbd.com).
 * 
 * Security rules:
 * - Never expose BULKSMSBD_API_KEY or BULKSMSBD_SENDER_ID to the browser.
 * - Customer inputs (01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX) are normalized
 *   to the provider requirement: 8801XXXXXXXXX.
 * - Provider acceptance (response_code: 202) is treated as successful submission.
 * - Never log raw SMS messages, OTP codes, or credentials.
 * - Safe mock transport mechanism for automated tests (no real SMS sent in tests).
 */

export interface BulkSmsSendParams {
  to: string
  message: string
}

export interface BulkSmsResult {
  success: boolean
  messageId?: string | number
  responseCode?: number
  rawResponse?: string
}

export class BulkSmsError extends Error {
  readonly code?: number | string

  constructor(message: string, code?: number | string) {
    super(message)
    this.name = 'BulkSmsError'
    this.code = code
  }
}

/**
 * Normalizes any Bangladeshi phone input into BulkSMSBD provider format:
 * - 01XXXXXXXXX   -> 8801XXXXXXXXX
 * - +8801XXXXXXXXX -> 8801XXXXXXXXX
 * - 8801XXXXXXXXX  -> 8801XXXXXXXXX
 * Returns null if the phone is not a valid 11-digit BD mobile number.
 */
export function normalizeBulkSmsPhone(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const cleaned = input.trim().replace(/[\s-]/g, '')
  if (!cleaned) return null

  let normalized: string
  if (cleaned.startsWith('+8801')) {
    normalized = cleaned.slice(1) // remove '+'
  } else if (cleaned.startsWith('8801')) {
    normalized = cleaned
  } else if (cleaned.startsWith('01')) {
    normalized = '88' + cleaned
  } else {
    return null
  }

  // Must match exactly 8801[3-9]XXXXXXXX (13 digits total)
  return /^8801[3-9]\d{8}$/.test(normalized) ? normalized : null
}

/**
 * Mock transport hook used by test suites to verify payloads without hitting real network.
 */
export type BulkSmsTransportFn = (payload: {
  number: string
  message: string
  senderId: string
}) => Promise<BulkSmsResult>

let activeMockTransport: BulkSmsTransportFn | null = null

export function setBulkSmsMockTransport(fn: BulkSmsTransportFn | null): void {
  activeMockTransport = fn
}

export function isBulkSmsConfigured(): boolean {
  return Boolean(
    process.env.BULKSMSBD_API_KEY &&
    process.env.BULKSMSBD_API_KEY.trim() &&
    process.env.BULKSMSBD_SENDER_ID &&
    process.env.BULKSMSBD_SENDER_ID.trim()
  )
}

/**
 * Dispatches an SMS via BulkSMSBD server-to-server POST contract.
 */
export async function sendBulkSms(
  params: BulkSmsSendParams | string,
  optionalMessage?: string
): Promise<BulkSmsResult> {
  const to = typeof params === 'string' ? params : params.to
  const message = typeof params === 'string' ? (optionalMessage || '') : params.message

  const normalizedNumber = normalizeBulkSmsPhone(to)
  if (!normalizedNumber) {
    throw new BulkSmsError('Invalid Bangladeshi phone number for SMS delivery')
  }

  // 1. If mock transport is explicitly provided, use it
  if (activeMockTransport) {
    return activeMockTransport({
      number: normalizedNumber,
      message,
      senderId: process.env.BULKSMSBD_SENDER_ID || 'TEST_SENDER',
    })
  }

  // 2. Automated test safeguard: NEVER send real SMS in test mode
  if (process.env.NODE_ENV === 'test' && !process.env.FORCE_REAL_SMS_IN_TEST) {
    return {
      success: true,
      messageId: `mock-test-${Date.now()}`,
      responseCode: 202,
    }
  }

  const apiKey = process.env.BULKSMSBD_API_KEY
  const senderId = process.env.BULKSMSBD_SENDER_ID

  if (!apiKey || !senderId) {
    throw new BulkSmsError('BulkSMSBD credentials are not configured')
  }

  const endpoint = process.env.BULKSMSBD_API_URL || 'https://bulksmsbd.net/api/smsapi'

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        type: 'text',
        number: normalizedNumber,
        senderid: senderId,
        message,
      }),
    })

    if (!res.ok) {
      throw new BulkSmsError(`BulkSMSBD HTTP error: ${res.status}`)
    }

    const data = await res.json().catch(() => null)
    const responseCode = data?.response_code !== undefined ? Number(data.response_code) : null

    // Code 202 = "Submit Successfully" in BulkSMSBD documentation
    if (responseCode === 202 || (data && data.success_message)) {
      return {
        success: true,
        messageId: data.message_id || undefined,
        responseCode: 202,
      }
    }

    // Provider error codes (e.g. 1002 empty field, 1003 invalid number, 1006 low balance, etc.)
    const errorMessage = data?.error_message || `BulkSMSBD rejected with code ${responseCode}`
    throw new BulkSmsError(errorMessage, responseCode ?? 'UNKNOWN')
  } catch (error) {
    if (error instanceof BulkSmsError) throw error
    throw new BulkSmsError('Failed to connect to BulkSMSBD gateway')
  }
}
