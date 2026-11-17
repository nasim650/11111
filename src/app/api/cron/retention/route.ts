import { NextRequest, NextResponse } from 'next/server'
import { executeRetentionJob } from '@/lib/retention'
import { getUserRoleFromRequest, isAdmin } from '@/lib/utils'

/**
 * Universal Protected Cron Endpoint for 6-Month Data Retention & Privacy Cleanup
 *
 * Security Hardening:
 * - Query-string secret support is strictly forbidden.
 * - In production, authentication strictly requires either:
 *     1. Admin session authentication (cookie-based for admin users)
 *     2. Authorization: Bearer <CRON_SECRET>
 *     3. Header: x-cron-secret: <CRON_SECRET>
 * - Default behavior is dry-run mode (dryRun=true) unless explicitly set to false.
 */
async function verifyCronAuth(request: NextRequest): Promise<boolean> {
  const role = await getUserRoleFromRequest(request)
  if (isAdmin(role)) {
    return true
  }

  const expectedSecret = process.env.CRON_SECRET

  // In production, CRON_SECRET must be explicitly defined if not admin
  if (process.env.NODE_ENV === 'production' && !expectedSecret) {
    console.error('CRON_SECRET is not configured in production')
    return false
  }

  // If secret is set, verify against headers ONLY
  if (expectedSecret) {
    const authHeader = request.headers.get('authorization')
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const headerSecret = request.headers.get('x-cron-secret')

    const provided = bearer || headerSecret
    return provided === expectedSecret
  }

  // Allow in development or test mode if no CRON_SECRET is set
  return process.env.NODE_ENV !== 'production'
}

export async function POST(request: NextRequest) {
  const authorized = await verifyCronAuth(request)
  if (!authorized) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: valid Authorization Bearer or x-cron-secret required' },
      { status: 401 }
    )
  }

  try {
    const url = new URL(request.url)
    const dryRunParam = url.searchParams.get('dryRun')
    const daysOldParam = url.searchParams.get('daysOld')

    let bodyData: Record<string, unknown> = {}
    try {
      bodyData = await request.json()
    } catch {
      // Empty or non-JSON body is valid
    }

    const dryRun =
      dryRunParam !== null
        ? dryRunParam === 'true'
        : typeof bodyData.dryRun === 'boolean'
        ? bodyData.dryRun
        : true // Default to safe dryRun mode

    const daysOld =
      daysOldParam !== null
        ? parseInt(daysOldParam, 10) || 180
        : typeof bodyData.daysOld === 'number'
        ? bodyData.daysOld
        : 180

    const result = await executeRetentionJob({ dryRun, daysOld })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Retention cron error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute retention cleanup' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
