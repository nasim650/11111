import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/utils'
import { verifyOtp } from '@/lib/otp'
import { csrfGuard, rateLimitOrResponse } from '@/lib/security'
import { normalizePhone } from '@/lib/validation'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const csrf = csrfGuard(request)
  if (csrf) return csrf
  const limited = await rateLimitOrResponse(request, 'verify-phone', 5, 15 * 60 * 1000)
  if (limited) return limited

  try {
    const authUser = await getUserFromRequest(request)
    if (!authUser) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const user = await db.user.findUnique({ where: { id: authUser.userId }, select: { phone: true } })
    let phone = user?.phone
    if (!phone && body?.phone) {
      phone = normalizePhone(body.phone)
    }
    if (!phone) return NextResponse.json({ success: false, error: 'Add a mobile number before verification' }, { status: 400 })

    const verified = await verifyOtp(phone, 'phone_verification', body.code)
    if (!verified.ok) return NextResponse.json({ success: false, error: verified.error }, { status: 400 })

    const updatedUser = await db.user.update({
      where: { id: authUser.userId },
      data: { isVerified: true, phone },
      select: { id: true, name: true, email: true, phone: true, role: true, isVerified: true }
    })
    return NextResponse.json({ success: true, data: { verified: true, user: updatedUser } })
  } catch (error) {
    console.error('Verify phone error:', error)
    return NextResponse.json({ success: false, error: 'Unable to verify your phone right now' }, { status: 500 })
  }
}
