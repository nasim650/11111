import { NextRequest, NextResponse } from 'next/server'
import { verifyOtp } from '@/lib/otp'
import { rateLimitOrResponse, csrfGuard } from '@/lib/security'
import { normalizePhone, isValidBangladeshPhone } from '@/lib/validation'
import { createCheckoutProof } from '@/lib/checkout-proof'

export async function POST(request: NextRequest) {
  const csrf = csrfGuard(request)
  if (csrf) return csrf

  const limited = await rateLimitOrResponse(request, 'guest-phone-verify-otp', 10, 15 * 60 * 1000)
  if (limited) return limited

  try {
    const body = await request.json().catch(() => ({}))
    const { phone: rawPhone, code } = body

    const normalized = normalizePhone(rawPhone)
    if (!normalized || !isValidBangladeshPhone(normalized)) {
      return NextResponse.json(
        {
          success: false,
          error: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন',
        },
        { status: 400 }
      )
    }

    if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return NextResponse.json(
        {
          success: false,
          error: '৬ ডিজিটের সঠিক ওটিপি কোড লিখুন',
        },
        { status: 400 }
      )
    }

    const verification = await verifyOtp(normalized, 'phone_verification', code.trim())
    if (!verification.ok) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error || 'ওটিপি কোডটি সঠিক নয় অথবা মেয়াদ শেষ হয়ে গেছে',
        },
        { status: 400 }
      )
    }

    // Generate cryptographic checkout proof for this verified phone number
    const checkoutProof = createCheckoutProof(normalized)

    return NextResponse.json({
      success: true,
      data: {
        verified: true,
        phone: normalized,
        checkoutProof,
      },
    })
  } catch (error) {
    console.error('Guest verify OTP error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
