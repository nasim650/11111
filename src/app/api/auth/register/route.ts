import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, generateToken } from '@/lib/auth'
import { validateRegistration, validationError } from '@/lib/validation'
import { csrfGuard, rateLimitOrResponse } from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    const csrf = csrfGuard(request)
    if (csrf) return csrf
    const limited = await rateLimitOrResponse(request, 'register', 3, 60 * 1000)
    if (limited) return limited

    const body = await request.json()
    const parsed = validateRegistration(body)
    if (!parsed.ok) return NextResponse.json(validationError(parsed.errors), { status: 400 })
    const { name, email, phone, password } = parsed.data

    // Check if user already exists
    const conditions = [
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : []),
    ]
    const existingUser = conditions.length > 0 
      ? await db.user.findFirst({ where: { OR: conditions } }) 
      : null

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User already exists with this email/phone' },
        { status: 409 }
      )
    }

    const hashedPassword = await hashPassword(password)

    const user = await db.user.create({
      data: {
        name: name || null,
        email: email || null,
        phone: phone || null,
        password: hashedPassword,
        role: 'customer',
        isVerified: false,
      },
    })

    // If phone-based signup, issue 6-digit OTP so the customer receives verification code immediately
    let otpSent = false
    if (phone) {
      try {
        const { issueOtp } = await import('@/lib/otp')
        await issueOtp(phone, 'phone_verification')
        otpSent = true
      } catch (otpErr) {
        console.warn('Initial registration OTP deferred:', otpErr instanceof Error ? otpErr.message : otpErr)
      }
    }

    const token = await generateToken(user.id, user.sessionVersion)

    const { password: _, ...userWithoutPassword } = user

    const response = NextResponse.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token,
        otpSent,
        requiresVerification: !user.isVerified,
      },
    }, { status: 201 })
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })
    return response
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to create your account right now. Please try again later.' },
      { status: 500 }
    )
  }
}
