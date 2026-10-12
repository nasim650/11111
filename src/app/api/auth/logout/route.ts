import { NextRequest, NextResponse } from 'next/server'
import { csrfGuard } from '@/lib/security'
import { getUserFromRequest } from '@/lib/utils'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const csrf = csrfGuard(request)
  if (csrf) return csrf

  const user = await getUserFromRequest(request)
  if (user) {
    // Reject this token (and every other active session for the account) on
    // the next authenticated request, even if a bearer token was copied.
    await db.user.update({
      where: { id: user.userId },
      data: { sessionVersion: { increment: 1 } },
    })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  })
  return response
}
