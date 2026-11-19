import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdmin } from '@/lib/utils'
import { getSafeOtpDiagnostics } from '@/lib/otp'

/**
 * Admin-only safe SMS diagnostics endpoint.
 * Returns only operational metadata (yes/no booleans and provider name).
 * Strictly NEVER outputs raw API keys, sender values, OTP codes, or secrets.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const diagnostics = getSafeOtpDiagnostics()
    return NextResponse.json({
      success: true,
      data: diagnostics,
    })
  } catch (error) {
    console.error('SMS diagnostics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve diagnostics' },
      { status: 500 }
    )
  }
}
