import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

type GatewayMode = 'sandbox' | 'live'

export type SSLCommerzConfig = {
  storeId: string
  storePassword: string
  mode: GatewayMode
  baseUrl: string
}

export type PaymentLogEntry = {
  at: string
  event: string
  status?: string | null
  transactionId?: string | null
  validationStatus?: string | null
  message?: string
  payload?: Record<string, unknown>
}

const SANDBOX_BASE = 'https://sandbox.sslcommerz.com'
const LIVE_BASE = 'https://securepay.sslcommerz.com'
const VALID_STATUSES = new Set(['VALID', 'VALIDATED'])

function redactPayload(payload: Record<string, unknown>) {
  const redacted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (/card_no|store_passwd|verify_sign/i.test(key)) {
      redacted[key] = '[redacted]'
    } else {
      redacted[key] = value
    }
  }
  return redacted
}

export async function getSSLCommerzConfig(dbClient?: any): Promise<SSLCommerzConfig | null> {
  const client = dbClient || db
  const configRows = await client.siteConfig.findMany({
    where: { key: { in: ['sslcommerzStoreId', 'sslcommerzPassword', 'sslcommerzMode'] } },
  })
  const siteConfig = Object.fromEntries(configRows.map((row) => [row.key, row.value]))

  const storeId = process.env.SSLCOMMERZ_STORE_ID || siteConfig.sslcommerzStoreId
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD || siteConfig.sslcommerzPassword

  // Production hardening (Round 4E): SSLCOMMERZ_IS_LIVE is the canonical
  // production switch. SSLCOMMERZ_MODE is kept as a fallback for backwards
  // compatibility with the v2 baseline.
  const liveFlag = process.env.SSLCOMMERZ_IS_LIVE
  const modeFlag = process.env.SSLCOMMERZ_MODE || siteConfig.sslcommerzMode
  const isLive = liveFlag
    ? liveFlag.toLowerCase() === 'true' || liveFlag === '1'
    : (modeFlag || 'sandbox').toLowerCase() === 'live'
  const mode: GatewayMode = isLive ? 'live' : 'sandbox'

  if (!storeId || !storePassword) return null

  return {
    storeId,
    storePassword,
    mode,
    baseUrl: mode === 'live' ? LIVE_BASE : SANDBOX_BASE,
  }
}

// ─── Production env-var validation (Round 4E) ─────────────────────────────
// Returns a list of missing required SSLCommerz environment variables.
// Empty list = production-ready. Used by health checks and startup logs.

export interface SSLCommerzEnvStatus {
  configured: boolean
  mode: 'sandbox' | 'live'
  missing: string[]
  present: string[]
}

export function getSSLCommerzEnvStatus(): SSLCommerzEnvStatus {
  const required = [
    'SSLCOMMERZ_STORE_ID',
    'SSLCOMMERZ_STORE_PASSWORD',
    'SSLCOMMERZ_IS_LIVE',
    'SSLCOMMERZ_SUCCESS_URL',
    'SSLCOMMERZ_FAIL_URL',
    'SSLCOMMERZ_CANCEL_URL',
    'SSLCOMMERZ_IPN_URL',
  ]
  const missing: string[] = []
  const present: string[] = []
  for (const key of required) {
    const value = process.env[key]
    if (value && value.trim()) {
      present.push(key)
    } else {
      missing.push(key)
    }
  }
  const liveFlag = process.env.SSLCOMMERZ_IS_LIVE
  const mode: 'sandbox' | 'live' =
    liveFlag && (liveFlag.toLowerCase() === 'true' || liveFlag === '1') ? 'live' : 'sandbox'
  return { configured: missing.length === 0, mode, missing, present }
}

// ─── Callback URL resolution (Round 4E) ───────────────────────────────────
// Resolves callback URLs from env vars first, falling back to the
// app-base-URL + default path pattern from the v2 baseline. This lets
// production set explicit public HTTPS URLs (required by SSLCommerz) while
// dev keeps the automatic localhost URLs.

export function getCallbackUrls(request: NextRequest): {
  successUrl: string
  failUrl: string
  cancelUrl: string
  ipnUrl: string
} {
  const baseUrl = getAppBaseUrl(request)
  return {
    successUrl: process.env.SSLCOMMERZ_SUCCESS_URL || `${baseUrl}/api/payments/sslcommerz/success`,
    failUrl: process.env.SSLCOMMERZ_FAIL_URL || `${baseUrl}/api/payments/sslcommerz/fail`,
    cancelUrl: process.env.SSLCOMMERZ_CANCEL_URL || `${baseUrl}/api/payments/sslcommerz/cancel`,
    ipnUrl: process.env.SSLCOMMERZ_IPN_URL || `${baseUrl}/api/payments/sslcommerz/ipn`,
  }
}

export function getAppBaseUrl(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (envUrl) return envUrl.replace(/\/$/, '')

  const proto = request.headers.get('x-forwarded-proto') || 'http'
  const host = request.headers.get('host') || 'localhost:3000'
  return `${proto}://${host}`
}

export async function parseSSLCommerzPayload(request: NextRequest): Promise<Record<string, string>> {
  const url = new URL(request.url)
  const queryParams = Object.fromEntries([...url.searchParams.entries()])

  if (request.method === 'GET') {
    return queryParams
  }

  const contentType = request.headers.get('content-type') || ''
  try {
    if (contentType.includes('application/json')) {
      const body = await request.json()
      return {
        ...queryParams,
        ...Object.fromEntries(
          Object.entries(body as Record<string, unknown>).map(([key, value]) => [key, String(value ?? '')])
        ),
      }
    }

    const formData = await request.formData()
    return {
      ...queryParams,
      ...Object.fromEntries(
        [...formData.entries()].map(([key, value]) => [key, String(value)])
      ),
    }
  } catch {
    return queryParams
  }
}

export function verifySSLCommerzSignature(
  payload: Record<string, string>,
  storePassword: string
): boolean {
  const verifySign = payload.verify_sign
  const verifyKey = payload.verify_key
  if (!verifySign || !verifyKey) return false

  const hashData: Record<string, string> = {}
  for (const key of verifyKey.split(',').map((item) => item.trim()).filter(Boolean)) {
    if (payload[key] !== undefined) hashData[key] = payload[key]
  }
  hashData.store_passwd = crypto.createHash('md5').update(storePassword).digest('hex')

  const hashString = Object.keys(hashData)
    .sort()
    .map((key) => `${key}=${hashData[key]}`)
    .join('&')

  const expected = crypto.createHash('md5').update(hashString).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(verifySign))
  } catch {
    return false
  }
}

export async function validateSSLCommerzTransaction(
  valId: string,
  config: SSLCommerzConfig
): Promise<Record<string, unknown> | null> {
  const url = new URL('/validator/api/validationserverAPI.php', config.baseUrl)
  url.searchParams.set('val_id', valId)
  url.searchParams.set('store_id', config.storeId)
  url.searchParams.set('store_passwd', config.storePassword)
  url.searchParams.set('v', '1')
  url.searchParams.set('format', 'json')

  const response = await fetch(url, { method: 'GET' })
  if (!response.ok) return null
  return response.json() as Promise<Record<string, unknown>>
}

export function appendPaymentLog(
  current: string | null | undefined,
  entry: Omit<PaymentLogEntry, 'at'>
): string {
  let previous: PaymentLogEntry[] = []
  if (current) {
    try {
      const parsed = JSON.parse(current) as { logs?: PaymentLogEntry[] }
      previous = Array.isArray(parsed.logs) ? parsed.logs : []
    } catch {
      previous = [{ at: new Date().toISOString(), event: 'legacy_gateway_response', payload: { raw: current } }]
    }
  }

  return JSON.stringify({
    logs: [
      ...previous.slice(-24),
      {
        at: new Date().toISOString(),
        ...entry,
        payload: entry.payload ? redactPayload(entry.payload) : undefined,
      },
    ],
  })
}

export function isSuccessfulSSLCommerzStatus(status: unknown): boolean {
  return typeof status === 'string' && VALID_STATUSES.has(status.toUpperCase())
}

export async function createSSLCommerzSession(params: {
  request: NextRequest
  config: SSLCommerzConfig
  order: {
    id: string
    orderNumber: string
    totalAmount: number
    guestName: string | null
    guestEmail: string | null
    guestPhone: string | null
    guestAddress: string | null
    user?: { email: string | null; phone: string | null; name: string | null } | null
    items: Array<{ productName: string; quantity: number }>
  }
  transactionId: string
}): Promise<Record<string, unknown>> {
  const { request, config, order, transactionId } = params
  const callbackUrls = getCallbackUrls(request)
  const customerName = order.guestName || order.user?.name || 'Khati Khadyo Customer'
  const customerEmail = order.guestEmail || order.user?.email || 'customer@khatikhadyo.local'
  const customerPhone = order.guestPhone || order.user?.phone || '01700000000'
  const customerAddress = order.guestAddress || 'Dhaka, Bangladesh'
  const productName = order.items.map((item) => `${item.productName} x${item.quantity}`).join(', ').slice(0, 250)

  const body = new URLSearchParams({
    store_id: config.storeId,
    store_passwd: config.storePassword,
    total_amount: order.totalAmount.toFixed(2),
    currency: 'BDT',
    tran_id: transactionId,
    success_url: callbackUrls.successUrl,
    fail_url: callbackUrls.failUrl,
    cancel_url: callbackUrls.cancelUrl,
    ipn_url: callbackUrls.ipnUrl,
    cus_name: customerName,
    cus_email: customerEmail,
    cus_add1: customerAddress.slice(0, 250),
    cus_city: 'Dhaka',
    cus_country: 'Bangladesh',
    cus_phone: customerPhone,
    shipping_method: 'Courier',
    num_of_item: String(order.items.reduce((sum, item) => sum + item.quantity, 0)),
    product_name: productName || `Order ${order.orderNumber}`,
    product_category: 'Food',
    product_profile: 'general',
    value_a: order.id,
    value_b: order.orderNumber,
    value_c: 'khati-khadyo',
    value_d: config.mode,
  })

  const response = await fetch(`${config.baseUrl}/gwprocess/v4/api.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`SSLCOMMERZ session request failed with status ${response.status}`)
  }

  return response.json() as Promise<Record<string, unknown>>
}

