import { NextRequest, NextResponse } from 'next/server'
import { expirePendingOrders } from '@/lib/order-inventory'

/**
 * Universal Protected Cron Endpoint for Expiring Stale Online Checkouts (30+ minutes).
 *
 * Security Hardening (Phase 1B.1):
 * - Query-string secret support has been strictly REMOVED to prevent secret leakage in logs,
 *   browser history, and referrers.
 * - In production, authentication strictly requires either:
 *     1. Authorization: Bearer <CRON_SECRET>
 *     2. Header: x-cron-secret: <CRON_SECRET>
 */
function verifyCronAuth(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET

  // In production, CRON_SECRET must be explicitly defined
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

  // Allow in development mode if no CRON_SECRET is set
  return process.env.NODE_ENV !== 'production'
}

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: valid Authorization Bearer or x-cron-secret required' },
      { status: 401 }
    )
  }

  try {
    const result = await expirePendingOrders()
    return NextResponse.json({
      success: true,
      data: {
        expiredCount: result.expiredCount,
        processedOrderIds: result.processedOrderIds,
        executedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Pending order expiry cron error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to expire pending orders' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
