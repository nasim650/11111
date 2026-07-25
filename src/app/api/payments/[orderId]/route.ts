import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserIdFromRequest, getUserRoleFromRequest, isAdmin } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const role = await getUserRoleFromRequest(request)
    const userId = await getUserIdFromRequest(request)

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
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

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        payment: order.payment,
      },
    })
  } catch (error) {
    console.error('Get payment error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
