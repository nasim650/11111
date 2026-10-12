import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { parseOtpPhone, verifyOtp } from '@/lib/otp'
import { csrfGuard, rateLimitOrResponse } from '@/lib/security'
import { validateStrongPassword } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const csrf = csrfGuard(request)
  if (csrf) return csrf
  const limited = await rateLimitOrResponse(request, 'reset-password', 5, 15 * 60 * 1000)
  if (limited) return limited

  try {
    const body = await request.json()
    const phone = parseOtpPhone(body.phone ?? body.identifier)
    const passwordError = validateStrongPassword(body.password)
    if (!phone || passwordError) {
      return NextResponse.json(
        { success: false, error: passwordError || 'Enter a valid Bangladeshi mobile number' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { phone }, select: { id: true } })
    if (!user) return NextResponse.json({ success: false, error: 'This code is invalid or has expired' }, { status: 400 })

    const verified = await verifyOtp(phone, 'password_reset', body.code)
    if (!verified.ok) return NextResponse.json({ success: false, error: verified.error }, { status: 400 })

    await db.user.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(body.password),
        // Invalidate every existing login after a password reset.
        sessionVersion: { increment: 1 },
      },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ success: false, error: 'Unable to reset your password right now' }, { status: 500 })
  }
}
