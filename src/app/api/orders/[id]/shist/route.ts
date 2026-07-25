import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, getUserIdFromRequest, isAdmin } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const role = await getUserRoleFromRequest(request)
    const userId = await getUserIdFromRequest(request)

    const order = await db.order.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    if (!isAdmin(role) && order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const history = await db.orderStatusHistory.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: history,
    })
  } catch (error) {
    console.error('Get status history error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
