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

    const user = await db.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
        isActive: true,
      },
    })

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
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
