import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPaginationParams, getUserRoleFromRequest, isAdmin, paginatedResponse } from '@/lib/utils'

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
    if (status) where.status = status
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

    return NextResponse.json({
      success: true,
      data: paginatedResponse(payments, total, page, limit),
    })
  } catch (error) {
    console.error('Get payments error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
