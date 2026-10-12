import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureOtpDeliveryConfigured, issueOtp, OtpCooldownError, OtpDeliveryUnavailableError, parseOtpPhone } from '@/lib/otp'
import { csrfGuard, rateLimitOrResponse } from '@/lib/security'

export async function POST(request: NextRequest) {
  const csrf = csrfGuard(request)
  if (csrf) return csrf
  const limited = await rateLimitOrResponse(request, 'forgot-password', 3, 15 * 60 * 1000)
  if (limited) return limited

  try {
    const body = await request.json()
    const phone = parseOtpPhone(body.phone ?? body.identifier)
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Enter a valid Bangladeshi mobile number' }, { status: 400 })
    }

    ensureOtpDeliveryConfigured()

    const user = await db.user.findUnique({ where: { phone }, select: { id: true } })
    // Avoid account enumeration. A correctly configured service gives the same
    // response whether or not an account is registered to the phone number.
    if (!user) return NextResponse.json({ success: true, data: { sent: true } })

    const result = await issueOtp(phone, 'password_reset')
    return NextResponse.json({ success: true, data: { sent: true, ...result } })
  } catch (error) {
    if (error instanceof OtpCooldownError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 429, headers: { 'Retry-After': String(error.retryAfter) } }
      )
    }
    if (error instanceof OtpDeliveryUnavailableError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 503 })
    }
    console.error('Forgot password OTP error:', error)
    return NextResponse.json({ success: false, error: 'Unable to send a verification code right now' }, { status: 500 })
  }
}
