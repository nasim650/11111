import { NextRequest, NextResponse } from 'next/server'
import { issueOtp, OtpCooldownError, OtpDeliveryUnavailableError } from '@/lib/otp'
import { rateLimitOrResponse, csrfGuard } from '@/lib/security'
import { normalizePhone, isValidBangladeshPhone } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const csrf = csrfGuard(request)
  if (csrf) return csrf

  const limited = await rateLimitOrResponse(request, 'guest-phone-send-otp', 5, 15 * 60 * 1000)
  if (limited) return limited

  try {
    const body = await request.json().catch(() => ({}))
    const rawPhone = body?.phone
    const normalized = normalizePhone(rawPhone)

    if (!normalized || !isValidBangladeshPhone(normalized)) {
      return NextResponse.json(
        {
          success: false,
          error: 'অনুগ্রহ করে সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)',
        },
        { status: 400 }
      )
    }

    const result = await issueOtp(normalized, 'phone_verification')
    return NextResponse.json({
      success: true,
      data: {
        sent: true,
        phone: normalized,
        expiresInSeconds: result.expiresInSeconds,
      },
    })
  } catch (error) {
    if (error instanceof OtpCooldownError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 429, headers: { 'Retry-After': String(error.retryAfter) } }
      )
    }
    if (error instanceof OtpDeliveryUnavailableError) {
      return NextResponse.json(
        {
          success: false,
          error: 'এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
        },
        { status: 503 }
      )
    }
    console.error('Guest send OTP error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
