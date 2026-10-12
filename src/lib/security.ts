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
