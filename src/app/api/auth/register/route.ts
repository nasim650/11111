import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, generateToken } from '@/lib/auth'
import { validateRegistration, validationError } from '@/lib/validation'
import { csrfGuard, rateLimitOrResponse } from '@/lib/security'

/**
 * User Registration Endpoint (Strict OTP-First for Phone Signups)
 *
 * Contract:
 * - Phone-based Signups:
 *   - Step 1 (no otpCode): Validates input, checks for existing user (409 if exists and not guest),
 *     issues OTP via issueOtp(). Returns 200 { success: true, data: { requiresOtp: true, ... } }.
 *     STRICT: Does NOT create user in DB, does NOT generate JWT, does NOT set auth_token cookie.
 *   - Step 2 (otpCode provided): Verifies OTP code first. If invalid/expired -> returns 400.
 *     If valid -> creates user in DB with isVerified: true (or claims guest profile), issues JWT,
 *     sets auth_token cookie, and returns 201 (or 200 for claimed profile).
 * - Email-only Signups:
 *   - Validates input, checks for existing user (409 if exists).
 *   - Creates user in DB, issues JWT, sets auth_token cookie, and returns 201.
 */
export async function POST(request: NextRequest) {
  try {
    const csrf = csrfGuard(request)
    if (csrf) return csrf
    const limited = await rateLimitOrResponse(request, 'register', 5, 60 * 1000)
    if (limited) return limited

    const body = await request.json().catch(() => ({}))
    const parsed = validateRegistration(body)
    if (!parsed.ok) return NextResponse.json(validationError(parsed.errors), { status: 400 })
    const { name, email, phone, password } = parsed.data
    const otpCode = body.otpCode ? String(body.otpCode).trim() : null

    // Check if user already exists
    const conditions = [
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : []),
    ]
    const existingUser = conditions.length > 0
      ? await db.user.findFirst({ where: { OR: conditions } })
      : null

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Phone-based Registration Flow (Strict OTP-First)
    // ──────────────────────────────────────────────────────────────────────────
    if (phone) {
      const isUnclaimedGuestProfile = Boolean(
        existingUser &&
        existingUser.phone === phone &&
        existingUser.password === null
      )

      // If a user already exists with this phone or email and is NOT an unclaimed guest profile -> 409
      if (existingUser && !isUnclaimedGuestProfile) {
        return NextResponse.json(
          { success: false, error: 'User already exists with this email/phone' },
          { status: 409 }
        )
      }

      // If claiming an unclaimed guest profile, ensure optional email isn't already used by another user
      if (isUnclaimedGuestProfile && existingUser && email && existingUser.email !== email) {
        const emailUser = await db.user.findFirst({ where: { email, id: { not: existingUser.id } } })
        if (emailUser) {
          return NextResponse.json(
            { success: false, error: 'User already exists with this email' },
            { status: 409 }
          )
        }
      }

      // STEP 1: No OTP code provided -> Issue OTP challenge, DO NOT create user or token
      if (!otpCode) {
        const { issueOtp, OtpCooldownError, OtpDeliveryUnavailableError } = await import('@/lib/otp')
        try {
          const issueResult = await issueOtp(phone, 'phone_verification')
          return NextResponse.json({
            success: true,
            data: {
              requiresOtp: true,
              phone,
              expiresInSeconds: issueResult.expiresInSeconds,
              claimProfile: isUnclaimedGuestProfile,
              message: isUnclaimedGuestProfile
                ? 'এই ফোন নম্বরে একটি গেস্ট প্রোফাইল রয়েছে। অ্যাকাউন্ট নিশ্চিত করতে ওটিপি কোড দিন।'
                : 'আপনার ফোন নম্বর নিশ্চিত করতে ওটিপি কোড পাঠানো হয়েছে।',
            },
          }, { status: 200 })
        } catch (otpErr) {
          if (otpErr instanceof OtpCooldownError) {
            return NextResponse.json(
              { success: false, error: otpErr.message },
              { status: 429, headers: { 'Retry-After': String(otpErr.retryAfter) } }
            )
          }
          if (otpErr instanceof OtpDeliveryUnavailableError) {
            return NextResponse.json(
              {
                success: false,
                error: otpErr.message || 'এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
              },
              { status: 503 }
            )
          }
          console.error('Registration OTP issue error:', otpErr)
          return NextResponse.json(
            { success: false, error: 'এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।' },
            { status: 503 }
          )
        }
      }

      // STEP 2: OTP code provided -> Verify OTP first
      if (!/^\d{6}$/.test(otpCode)) {
        return NextResponse.json(
          { success: false, error: 'অনুগ্রহ করে সঠিক ৬ ডিজিটের ওটিপি কোড দিন।' },
          { status: 400 }
        )
      }

      const { verifyOtp } = await import('@/lib/otp')
      const verifyResult = await verifyOtp(phone, 'phone_verification', otpCode)
      if (!verifyResult.ok) {
        return NextResponse.json(
          { success: false, error: verifyResult.error || 'ওটিপি কোডটি সঠিক নয় বা মেয়াদ শেষ হয়ে গেছে।' },
          { status: 400 }
        )
      }

      // Concurrency check before mutation
      if (!isUnclaimedGuestProfile) {
        const conflictUser = await db.user.findFirst({
          where: {
            OR: [
              { phone },
              ...(email ? [{ email }] : []),
            ],
          },
        })
        if (conflictUser) {
          return NextResponse.json(
            { success: false, error: 'User already exists with this email/phone' },
            { status: 409 }
          )
        }
      }

      // Hash password and complete registration
      const hashedPassword = await hashPassword(password)

      if (isUnclaimedGuestProfile && existingUser) {
        const updatedUser = await db.user.update({
          where: { id: existingUser.id },
          data: {
            name: name || existingUser.name,
            email: email || existingUser.email,
            password: hashedPassword,
            isVerified: true,
          },
        })

        const token = await generateToken(updatedUser.id, updatedUser.sessionVersion)
        const { password: _, ...userWithoutPassword } = updatedUser

        const response = NextResponse.json({
          success: true,
          data: {
            user: userWithoutPassword,
            token,
            claimed: true,
            requiresVerification: false,
          },
        }, { status: 200 })
        response.cookies.set('auth_token', token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        })
        return response
      }

      // Brand-new phone signup (Created ONLY after OTP verification)
      const user = await db.user.create({
        data: {
          name: name || null,
          email: email || null,
          phone,
          password: hashedPassword,
          role: 'customer',
          isVerified: true,
        },
      })

      const token = await generateToken(user.id, user.sessionVersion)
      const { password: _, ...userWithoutPassword } = user

      const response = NextResponse.json({
        success: true,
        data: {
          user: userWithoutPassword,
          token,
          requiresVerification: false,
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
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Email-only Registration Flow (No phone provided)
    // ──────────────────────────────────────────────────────────────────────────
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User already exists with this email' },
        { status: 409 }
      )
    }

    const hashedPassword = await hashPassword(password)

    const user = await db.user.create({
      data: {
        name: name || null,
        email: email || null,
        phone: null,
        password: hashedPassword,
        role: 'customer',
        isVerified: false,
      },
    })

    const token = await generateToken(user.id, user.sessionVersion)
    const { password: _, ...userWithoutPassword } = user

    const response = NextResponse.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token,
        requiresVerification: true,
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
