import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdmin } from '@/lib/utils'
import { getSafeOtpDiagnostics } from '@/lib/otp'
import { checkCloudSmsBalance, type CloudSmsBalanceResult } from '@/lib/cloudsmsbd'

function detectSenderType(providerName: string): 'non-masking' | 'masking' | 'unknown' {
  const rawSender =
    providerName === 'cloudsmsbd'
      ? process.env.CLOUDSMSBD_SENDER_ID?.trim()
      : providerName === 'bulksmsbd'
        ? process.env.BULKSMSBD_SENDER_ID?.trim()
        : process.env.SMS_SENDER_ID?.trim()

  if (!rawSender) return 'unknown'
  return /^\+?\d+$/.test(rawSender) ? 'non-masking' : 'masking'
}

/**
 * Admin-only safe SMS diagnostics and live balance endpoint.
 * Returns only operational metadata (yes/no booleans, provider name, sender type, and live balance).
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
    const senderType = detectSenderType(diagnostics.providerName)

    let balance: CloudSmsBalanceResult | null = null
    if (diagnostics.providerName === 'cloudsmsbd') {
      balance = await checkCloudSmsBalance()
    } else if (!diagnostics.providerConfigured) {
      balance = {
        ok: false,
        status: 'unconfigured',
        error: 'SMS provider is not configured',
        checkedAt: new Date().toISOString(),
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...diagnostics,
        senderType,
        balance,
      },
    })
  } catch (error) {
    console.error('SMS diagnostics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve diagnostics' },
      { status: 500 }
    )
  }
}
