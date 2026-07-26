import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, generateToken } from '@/lib/auth'
import { validateLogin, validationError } from '@/lib/validation'
import { csrfGuard, rateLimitOrResponse } from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    const csrf = csrfGuard(request)
    if (csrf) return csrf
    const limited = rateLimitOrResponse(request, 'login', 5, 60 * 1000)
    if (limited) return limited

    const body = await request.json()
    const parsed = validateLogin(body)
    if (!parsed.ok) return NextResponse.json(validationError(parsed.errors), { status: 400 })
    const { email, phone, password } = parsed.data

    const conditions = [
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : []),
    ]

    const user = conditions.length > 0
      ? await db.user.findFirst({
          where: {
            OR: conditions,
            isActive: true,
          },
        })
      : null

    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const isValid = await verifyPassword(password, user.password)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const token = await generateToken(user.id)

    const { password: _, ...userWithoutPassword } = user

    const response = NextResponse.json({
      success: true,
      data: { user: userWithoutPassword, token },
    })
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })
    return response
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error'
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    )
  }
}
