import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/utils'
import { issueOtp, OtpCooldownError, OtpDeliveryUnavailableError } from '@/lib/otp'
import { csrfGuard, rateLimitOrResponse } from '@/lib/security'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const csrf = csrfGuard(request)
  if (csrf) return csrf
  const limited = await rateLimitOrResponse(request, 'phone-verification', 3, 15 * 60 * 1000)
  if (limited) return limited

  try {
    const authUser = await getUserFromRequest(request)
    if (!authUser) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })

    const user = await db.user.findUnique({ where: { id: authUser.userId }, select: { phone: true, isVerified: true } })
    if (!user?.phone) return NextResponse.json({ success: false, error: 'Add a mobile number before verification' }, { status: 400 })
    if (user.isVerified) return NextResponse.json({ success: true, data: { verified: true } })

    const result = await issueOtp(user.phone, 'phone_verification')
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
    console.error('Send phone verification error:', error)
    return NextResponse.json({ success: false, error: 'Unable to send a verification code right now' }, { status: 500 })
  }
}
