/**
 * Cloud SMS BD Server-Side Adapter
 * ---------------------------------
 * Server-only adapter for Cloud SMS BD (p1.cloudsmsbd.com).
 *
 * Security & Reliability Rules:
 * - Server-only execution. CLOUDSMSBD_API_KEY must NEVER be exposed to the browser.
 * - No NEXT_PUBLIC_ prefixes for any provider credentials.
 * - Input normalization: 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX -> 8801XXXXXXXXX.
 * - Encoding detection: English text -> IsUnicode=2, Bangla text -> IsUnicode=1.
 * - Documented success code is 1. All provider error codes (2, 3, 4, 5, 6, 7, 10, 11, 101, 405)
 *   are safely mapped without leaking credentials, balances, or internal details.
 * - Never log raw API keys, sender IDs, full phone numbers, OTP codes, or raw payloads.
 * - Mock transport mechanism for automated testing without sending real SMS.
 */

export interface CloudSmsSendParams {
  to: string
  message: string
  isUnicode?: 1 | 2
}

export interface CloudSmsResult {
  success: boolean
  code: number
  messageId?: string
  rawStatus?: string
}

export class CloudSmsError extends Error {
  readonly code?: number | string
  readonly safeMessage: string

  constructor(message: string, code?: number | string, safeMessage?: string) {
    super(message)
    this.name = 'CloudSmsError'
    this.code = code
    this.safeMessage = safeMessage || message
  }
}

/**
 * Mapping of Cloud SMS BD provider response codes (per official p1.cloudsmsbd.com docs)
 * to safe, user-facing error messages.
 * Never leaks balances, account status, API keys, or raw system errors to end users.
 */
export const CLOUD_SMS_SAFE_ERRORS: Record<number, string> = {
  2: 'এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ (কনফিগারেশন ত্রুটি)', // ApiKey Not Found || Invalid ApiKey
  3: 'এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ (সেন্ডার আইডি ত্রুটি)', // SenderID Not Found || Invalid SenderID
  4: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন', // Numbers Not Found
  5: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন', // Invalid Mobile Number
  6: 'এসএমএস বার্তা ত্রুটিপূর্ণ', // SMS Body Not Found || Empty SMS Body
  7: 'এসএমএস বার্তা এনকোডিং ত্রুটি', // Allowed only 1 or 2 for IsUnicode
  10: 'এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ', // Not Enough Balance (never disclose balance to end users)
  11: 'এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ', // Balance and SMS rate
  101: 'এসএমএস গেটওয়ে সাময়িক বিভ্রাটে রয়েছে', // Not Enough Balance in administrator account
  405: 'অনুরোধ পদ্ধতি সমর্থিত নয়', // Method Not Allowed
}

/**
 * Returns a sanitized, safe user-facing error message for a given provider error code.
 */
export function getSafeCloudSmsErrorMessage(code: number | string | undefined | null): string {
  if (code !== null && code !== undefined) {
    const num = Number(code)
    if (!isNaN(num) && CLOUD_SMS_SAFE_ERRORS[num]) {
      return CLOUD_SMS_SAFE_ERRORS[num]
    }
  }
  return 'এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
}

/**
 * Normalizes any Bangladeshi phone input into Cloud SMS BD provider format (8801XXXXXXXXX):
 * - 01XXXXXXXXX    -> 8801XXXXXXXXX
 * - +8801XXXXXXXXX -> 8801XXXXXXXXX
 * - 8801XXXXXXXXX  -> 8801XXXXXXXXX
 *
 * Rejects non-Bangladeshi numbers, invalid operators, and malformed inputs.
 */
export function normalizeCloudSmsPhone(input: unknown): string | null {
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
 * Detects whether a message should use Bangla Unicode (IsUnicode=1) or standard GSM/English (IsUnicode=2).
 * Bengali script Unicode range: U+0980 to U+09FF.
 */
export function detectIsUnicode(message: string): 1 | 2 {
  const hasBengali = /[\u0980-\u09FF]/.test(message)
  return hasBengali ? 1 : 2
}

/**
 * Masks a phone number for safe logging (e.g. 88017****5678).
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 8) return '***'
  return `${phone.slice(0, 5)}****${phone.slice(-4)}`
}

/**
 * Mock transport hook used by test suites to verify payloads without hitting real network.
 */
export type CloudSmsTransportFn = (payload: {
  ApiKey: string
  SenderID: string
  number: string
  sms: string
  IsUnicode: 1 | 2
}) => Promise<CloudSmsResult>

let activeMockTransport: CloudSmsTransportFn | null = null

export function setCloudSmsMockTransport(fn: CloudSmsTransportFn | null): void {
  activeMockTransport = fn
}

/**
 * Checks whether Cloud SMS BD is configured in the server environment.
 */
export function isCloudSmsConfigured(): boolean {
  return Boolean(
    process.env.CLOUDSMSBD_API_KEY &&
    process.env.CLOUDSMSBD_API_KEY.trim() &&
    process.env.CLOUDSMSBD_SENDER_ID &&
    process.env.CLOUDSMSBD_SENDER_ID.trim()
  )
}

/**
 * Safely parses the Cloud SMS BD response string or JSON.
 * Documented success code is 1.
 */
export function parseCloudSmsResponse(rawText: string): CloudSmsResult {
  if (!rawText || !rawText.trim()) {
    throw new CloudSmsError(
      'Empty response from Cloud SMS BD gateway',
      101,
      getSafeCloudSmsErrorMessage(101)
    )
  }

  const trimmed = rawText.trim()
  let parsedJson: Record<string, unknown> | null = null
  try {
    parsedJson = JSON.parse(trimmed)
  } catch {
    // Non-JSON response
  }

  let code: number | null = null
  let messageId: string | undefined = undefined

  if (parsedJson && typeof parsedJson === 'object') {
    const rawCode =
      parsedJson.code ??
      parsedJson.ErrorCode ??
      parsedJson.error_code ??
      parsedJson.error ??
      parsedJson.status ??
      parsedJson.response_code

    if (rawCode !== undefined && rawCode !== null) {
      const num = Number(rawCode)
      if (!isNaN(num)) {
        code = num
      }
    }

    if (parsedJson.message_id || parsedJson.messageId || parsedJson.msg_id || parsedJson.id) {
      messageId = String(
        parsedJson.message_id || parsedJson.messageId || parsedJson.msg_id || parsedJson.id
      )
    }
  } else {
    // Plain text response, e.g. "1" or "1:Success"
    const match = trimmed.match(/^(\d+)/)
    if (match) {
      code = Number(match[1])
    }
  }

  if (code === 1) {
    return {
      success: true,
      code: 1,
      messageId,
      rawStatus: 'Success',
    }
  }

  const safeMsg = getSafeCloudSmsErrorMessage(code ?? 101)
  throw new CloudSmsError(
    `Cloud SMS BD rejected with code: ${code ?? 'UNKNOWN'}`,
    code ?? 'UNKNOWN',
    safeMsg
  )
}

/**
 * Dispatches an SMS via Cloud SMS BD server-to-server API contract.
 */
export async function sendCloudSms(
  params: CloudSmsSendParams | string,
  optionalMessage?: string
): Promise<CloudSmsResult> {
  const to = typeof params === 'string' ? params : params.to
  const message = typeof params === 'string' ? (optionalMessage || '') : params.message

  const normalizedNumber = normalizeCloudSmsPhone(to)
  if (!normalizedNumber) {
    throw new CloudSmsError(
      'Invalid Bangladeshi phone number for SMS delivery',
      4,
      getSafeCloudSmsErrorMessage(4)
    )
  }

  const apiKey = process.env.CLOUDSMSBD_API_KEY?.trim()
  const senderId = process.env.CLOUDSMSBD_SENDER_ID?.trim()

  if (!apiKey || !senderId) {
    throw new CloudSmsError(
      'Cloud SMS BD credentials are not configured',
      2,
      getSafeCloudSmsErrorMessage(2)
    )
  }

  const isUnicodeVal: 1 | 2 =
    typeof params === 'object' && params.isUnicode
      ? params.isUnicode
      : detectIsUnicode(message)

  // 1. Mock transport hook (for automated unit/integration tests)
  if (activeMockTransport) {
    return activeMockTransport({
      ApiKey: apiKey,
      SenderID: senderId,
      number: normalizedNumber,
      sms: message,
      IsUnicode: isUnicodeVal,
    })
  }

  // 2. Automated test safeguard: NEVER send real SMS in test mode
  if (process.env.NODE_ENV === 'test' && !process.env.FORCE_REAL_SMS_IN_TEST) {
    return {
      success: true,
      code: 1,
      messageId: `mock-cloudsms-${Date.now()}`,
      rawStatus: 'Mock test accepted',
    }
  }

  const endpoint = process.env.CLOUDSMSBD_API_URL?.trim() || 'https://p1.cloudsmsbd.com/api/sms'

  const formBody = new URLSearchParams()
  formBody.set('ApiKey', apiKey)
  formBody.set('SenderID', senderId)
  formBody.set('number', normalizedNumber)
  formBody.set('sms', message)
  formBody.set('IsUnicode', String(isUnicodeVal))

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json, text/plain, */*',
      },
      body: formBody.toString(),
    })

    if (!res.ok) {
      throw new CloudSmsError(
        `Cloud SMS BD HTTP error: ${res.status}`,
        res.status,
        getSafeCloudSmsErrorMessage(res.status)
      )
    }

    const rawText = await res.text()
    return parseCloudSmsResponse(rawText)
  } catch (error) {
    if (error instanceof CloudSmsError) throw error
    throw new CloudSmsError(
      'Failed to connect to Cloud SMS BD gateway',
      101,
      getSafeCloudSmsErrorMessage(101)
    )
  }
}

export interface CloudSmsBalanceResult {
  ok: boolean
  balance?: number
  rawBalance?: string
  status: 'healthy' | 'low' | 'empty' | 'unconfigured' | 'error'
  error?: string
  checkedAt: string
}

export type CloudSmsBalanceTransportFn = (payload: {
  ApiKey: string
  endpoint: string
}) => Promise<string>

let activeMockBalanceTransport: CloudSmsBalanceTransportFn | null = null

export function setCloudSmsBalanceMockTransport(fn: CloudSmsBalanceTransportFn | null): void {
  activeMockBalanceTransport = fn
}

const LOW_BALANCE_THRESHOLD = 50

export function parseCloudSmsBalanceResponse(rawText: string): CloudSmsBalanceResult {
  const checkedAt = new Date().toISOString()
  const trimmed = rawText?.trim() || ''

  if (!trimmed) {
    return {
      ok: false,
      status: 'error',
      error: 'Empty balance response from Cloud SMS BD',
      checkedAt,
    }
  }

  let parsedValue: number | null = null
  let parsedJson: Record<string, unknown> | null = null
  try {
    parsedJson = JSON.parse(trimmed)
  } catch {
    // Plain text response
  }

  if (parsedJson && typeof parsedJson === 'object') {
    const errCode = parsedJson.ErrorCode ?? parsedJson.error_code ?? parsedJson.code
    if (
      errCode !== undefined &&
      errCode !== null &&
      Number(errCode) === 2 &&
      parsedJson.balance === undefined &&
      parsedJson.Balance === undefined
    ) {
      return {
        ok: false,
        status: 'error',
        error: 'Invalid or missing Cloud SMS BD API key',
        checkedAt,
      }
    }

    const rawField =
      parsedJson.balance ??
      parsedJson.Balance ??
      parsedJson.credit ??
      parsedJson.Credit ??
      parsedJson.amount ??
      parsedJson.Amount

    if (rawField !== undefined && rawField !== null) {
      const num = Number(String(rawField).replace(/[^0-9.-]/g, ''))
      if (!isNaN(num)) {
        parsedValue = num
      }
    }
  } else {
    if (trimmed === '2') {
      return {
        ok: false,
        status: 'error',
        error: 'Invalid or missing Cloud SMS BD API key',
        checkedAt,
      }
    }
    const match = trimmed.match(/-?\d+(?:\.\d+)?/)
    if (match) {
      const num = Number(match[0])
      if (!isNaN(num)) {
        parsedValue = num
      }
    }
  }

  if (parsedValue === null) {
    return {
      ok: false,
      status: 'error',
      rawBalance: trimmed.slice(0, 64),
      error: 'Unable to parse balance from gateway response',
      checkedAt,
    }
  }

  const status: CloudSmsBalanceResult['status'] =
    parsedValue <= 0 ? 'empty' : parsedValue < LOW_BALANCE_THRESHOLD ? 'low' : 'healthy'

  return {
    ok: true,
    balance: parsedValue,
    rawBalance: String(parsedValue),
    status,
    checkedAt,
  }
}

export async function checkCloudSmsBalance(): Promise<CloudSmsBalanceResult> {
  const checkedAt = new Date().toISOString()
  const apiKey = process.env.CLOUDSMSBD_API_KEY?.trim()

  if (!apiKey) {
    return {
      ok: false,
      status: 'unconfigured',
      error: 'CLOUDSMSBD_API_KEY is not configured',
      checkedAt,
    }
  }

  const smsUrl = process.env.CLOUDSMSBD_API_URL?.trim() || 'https://p1.cloudsmsbd.com/api/sms'
  const endpoint =
    process.env.CLOUDSMSBD_BALANCE_URL?.trim() || smsUrl.replace(/\/api\/sms\/?$/, '/api/balance')

  if (activeMockBalanceTransport) {
    try {
      const rawText = await activeMockBalanceTransport({ ApiKey: apiKey, endpoint })
      return parseCloudSmsBalanceResponse(rawText)
    } catch {
      return {
        ok: false,
        status: 'error',
        error: 'Failed to connect to Cloud SMS BD balance endpoint',
        checkedAt,
      }
    }
  }

  if (process.env.NODE_ENV === 'test' && !process.env.FORCE_REAL_SMS_IN_TEST) {
    return {
      ok: true,
      balance: 250,
      rawBalance: '250',
      status: 'healthy',
      checkedAt,
    }
  }

  try {
    const formBody = new URLSearchParams()
    formBody.set('ApiKey', apiKey)

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json, text/plain, */*',
      },
      body: formBody.toString(),
      cache: 'no-store',
    })

    if (!res.ok) {
      return {
        ok: false,
        status: 'error',
        error: `Cloud SMS BD balance HTTP error: ${res.status}`,
        checkedAt,
      }
    }

    const rawText = await res.text()
    return parseCloudSmsBalanceResponse(rawText)
  } catch {
    return {
      ok: false,
      status: 'error',
      error: 'Failed to reach Cloud SMS BD balance endpoint',
      checkedAt,
    }
  }
}
