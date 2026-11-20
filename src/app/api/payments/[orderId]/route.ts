import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserIdFromRequest, getUserRoleFromRequest, isAdmin } from '@/lib/utils'
import { sanitizeGatewayResponse } from '@/app/api/payments/route'

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
        items: true,
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

    const safePayment = order.payment
      ? {
          id: order.payment.id,
          transactionId: order.payment.transactionId,
          amount: order.payment.amount,
          method: order.payment.method,
          gateway: order.payment.gateway,
          status: order.payment.status,
          paidAt: order.payment.paidAt,
          createdAt: order.payment.createdAt,
          updatedAt: order.payment.updatedAt,
          gatewayResponse: sanitizeGatewayResponse(order.payment.gatewayResponse),
        }
      : null

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        guestName: order.guestName || null,
        guestPhone: order.guestPhone || null,
        guestEmail: order.guestEmail || null,
        user: order.user || null,
        itemsCount: order.items?.length || 0,
        createdAt: order.createdAt,
        payment: safePayment,
      },
    })
  } catch (error) {
    console.error('Get payment details error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
