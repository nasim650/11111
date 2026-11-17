import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPaginationParams, getUserRoleFromRequest, isAdmin, paginatedResponse } from '@/lib/utils'

function sanitizeGatewayResponse(gatewayResponse: string | null): string | null {
  if (!gatewayResponse) return null
  try {
    const parsed = JSON.parse(gatewayResponse) as {
      logs?: Array<{
        at?: string
        event?: string
        status?: string
        transactionId?: string
        message?: string
        [key: string]: unknown
      }>
      [key: string]: unknown
    }

    if (Array.isArray(parsed.logs)) {
      const sanitizedLogs = parsed.logs.map((log) => ({
        at: typeof log.at === 'string' ? log.at : new Date().toISOString(),
        event: typeof log.event === 'string' ? log.event : 'event',
        status: typeof log.status === 'string' ? log.status : undefined,
        transactionId: typeof log.transactionId === 'string' ? log.transactionId : undefined,
        message: typeof log.message === 'string' ? log.message : undefined,
      }))
      return JSON.stringify({ logs: sanitizedLogs })
    }

    return JSON.stringify({ logs: [] })
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const { page, limit, skip } = getPaginationParams(url)
    const status = url.searchParams.get('status')
    const gateway = url.searchParams.get('gateway')

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') where.status = status
    if (gateway) where.gateway = gateway

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              guestName: true,
              guestEmail: true,
              guestPhone: true,
              paymentStatus: true,
              orderStatus: true,
              totalAmount: true,
              createdAt: true,
              user: { select: { id: true, name: true, email: true, phone: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.payment.count({ where }),
    ])

    const sanitizedPayments = payments.map((p) => ({
      ...p,
      gatewayResponse: sanitizeGatewayResponse(p.gatewayResponse),
    }))

    return NextResponse.json({
      success: true,
      data: paginatedResponse(sanitizedPayments, total, page, limit),
    })
  } catch (error) {
    console.error('Get payments error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
