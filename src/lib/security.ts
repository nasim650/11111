import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { getUserFromRequest, isAdmin } from '@/lib/utils'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export async function rateLimitOrResponse(
  request: NextRequest,
  key: string,
  limit: number,
  windowMs: number
): Promise<NextResponse | null> {
  const clientIp = getClientIp(request)
  const result = await rateLimit(`${key}:${clientIp}`, limit, windowMs)
  if (result.success) return null

  return NextResponse.json(
    { success: false, error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((result.reset - Date.now()) / 1000)) },
    }
  )
}

export function csrfGuard(request: NextRequest): NextResponse | null {
  if (!UNSAFE_METHODS.has(request.method)) return null

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!origin || !host) return null

  try {
    const originUrl = new URL(origin)
    if (originUrl.host === host) return null
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid origin' }, { status: 403 })
  }

  return NextResponse.json({ success: false, error: 'CSRF validation failed' }, { status: 403 })
}

export async function requireAdmin(request: NextRequest): Promise<{
  ok: true
  userId: string
  role: string
} | {
  ok: false
  response: NextResponse
}> {
  const user = await getUserFromRequest(request)
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (!isAdmin(user.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      ),
    }
  }

  return { ok: true, userId: user.userId, role: user.role }
}

export function secureJson(data: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

/**
 * Strict internal redirect validator to eliminate Open Redirect vulnerabilities.
 * Allows ONLY valid relative paths starting with a single '/' (e.g. '/orders/ORD-123').
 * Strictly rejects protocol-relative URLs (//evil.com), backslash tricks (/\evil.com, /\\evil.com),
 * external absolute URLs (https://...), javascript: schemes, control chars, and CRLF injection.
 */
export function sanitizeInternalRedirect(
  target: string | null | undefined,
  fallback: string = '/'
): string {
  if (!target || typeof target !== 'string') return fallback

  const clean = target.trim()
  if (!clean) return fallback

  // Reject CRLF and control characters
  if (/[\r\n\0\t]/.test(clean)) return fallback

  // Must begin with a single slash, not followed by another slash or backslash
  if (!clean.startsWith('/') || clean.startsWith('//') || clean.startsWith('/\\') || clean.startsWith('\\')) {
    return fallback
  }

  // Must not contain backslashes anywhere in the path
  if (clean.includes('\\')) {
    return fallback
  }

  try {
    // Parse against a dummy base origin to verify hostname/protocol cannot be spoofed
    const parsed = new URL(clean, 'http://localhost')
    if (parsed.origin !== 'http://localhost' || parsed.protocol !== 'http:') {
      return fallback
    }

    // Ensure pathname begins with '/'
    if (!parsed.pathname.startsWith('/')) {
      return fallback
    }

    // Return the safe internal pathname + search + hash
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

