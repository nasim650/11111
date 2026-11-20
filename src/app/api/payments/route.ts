import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPaginationParams, getUserRoleFromRequest, isAdmin, paginatedResponse } from '@/lib/utils'

export function sanitizeGatewayResponse(gatewayResponse: string | null): string | null {
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
    const search = url.searchParams.get('search')?.trim()
    const status = url.searchParams.get('status')
    const gateway = url.searchParams.get('gateway')
    const method = url.searchParams.get('method')
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') where.status = status
    if (gateway && gateway !== 'all') where.gateway = gateway
    if (method && method !== 'all') where.method = method

    // Date range filter
    if (dateFrom || dateTo) {
      const createdAtFilter: Record<string, Date> = {}
      if (dateFrom) {
        const fromDate = new Date(dateFrom)
        if (!isNaN(fromDate.getTime())) {
          createdAtFilter.gte = fromDate
        }
      }
      if (dateTo) {
        const toDate = new Date(dateTo)
        if (!isNaN(toDate.getTime())) {
          // Include full end date
          toDate.setHours(23, 59, 59, 999)
          createdAtFilter.lte = toDate
        }
      }
      if (Object.keys(createdAtFilter).length > 0) {
        where.createdAt = createdAtFilter
      }
    }

    // Search by order number, transaction ID, customer phone or customer email
    if (search) {
      where.OR = [
        { transactionId: { contains: search } },
        { order: { orderNumber: { contains: search } } },
        { order: { guestPhone: { contains: search } } },
        { order: { guestEmail: { contains: search } } },
        { order: { user: { phone: { contains: search } } } },
        { order: { user: { email: { contains: search } } } },
        { order: { user: { name: { contains: search } } } },
      ]
    }

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
              paymentMethod: true,
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
      id: p.id,
      transactionId: p.transactionId || null,
      status: p.status,
      amount: p.amount ?? p.order?.totalAmount ?? 0,
      method: p.method || p.order?.paymentMethod || 'cod',
      gateway: p.gateway || (p.method === 'online' ? 'sslcommerz' : 'cod'),
      paidAt: p.paidAt ? (p.paidAt instanceof Date ? p.paidAt.toISOString() : String(p.paidAt)) : null,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
      updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
      gatewayResponse: sanitizeGatewayResponse(p.gatewayResponse),
      order: p.order
        ? {
            id: p.order.id,
            orderNumber: p.order.orderNumber || 'N/A',
            guestName: p.order.guestName || null,
            guestEmail: p.order.guestEmail || null,
            guestPhone: p.order.guestPhone || null,
            paymentMethod: p.order.paymentMethod || p.method || 'cod',
            paymentStatus: p.order.paymentStatus || p.status,
            orderStatus: p.order.orderStatus || 'pending',
            totalAmount: p.order.totalAmount ?? p.amount ?? 0,
            createdAt: p.order.createdAt instanceof Date ? p.order.createdAt.toISOString() : String(p.order.createdAt),
            user: p.order.user
              ? {
                  id: p.order.user.id,
                  name: p.order.user.name || null,
                  email: p.order.user.email || null,
                  phone: p.order.user.phone || null,
                }
              : null,
          }
        : null,
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
