import { cookies, headers } from 'next/headers.js'
import { verifyToken } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Validates a JWT token string against the database and returns the authenticated user payload.
 */
export async function getSessionUserFromToken(
  token: string,
  customDb?: any
): Promise<{ userId: string; role: string } | null> {
  const prisma = customDb || db
  try {
    const payload = await verifyToken(token)
    if (!payload?.userId) return null

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, sessionVersion: true },
    })

    if (!user || user.sessionVersion !== payload.sessionVersion) return null
    return { userId: user.id, role: user.role }
  } catch {
    return null
  }
}

/**
 * Server-side session resolver for Next.js App Router Server Components.
 * Reads Authorization header or httpOnly auth_token cookie.
 */
export async function getServerSessionUser(
  customDb?: any
): Promise<{ userId: string; role: string } | null> {
  const prisma = customDb || db
  try {
    let token: string | null = null

    // 1. Try reading Authorization header
    try {
      const headerStore = await headers()
      const authHeader = headerStore.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7)
      }
    } catch {
      // Ignore if headers() is unavailable in current context
    }

    // 2. Try reading auth_token cookie
    if (!token) {
      try {
        const cookieStore = await cookies()
        token = cookieStore.get('auth_token')?.value || null
      } catch {
        // Ignore if cookies() is unavailable in current context
      }
    }

    if (!token) return null
    return getSessionUserFromToken(token, prisma)
  } catch {
    return null
  }
}
