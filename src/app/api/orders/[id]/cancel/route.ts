import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserIdFromRequest, getUserRoleFromRequest, isAdmin } from '@/lib/utils'

// Order tracking timeline steps
const TRACKING_STEPS = [
  { key: 'pending', label: 'Order Placed', description: 'Your order has been placed successfully', step: 1 },
  { key: 'processing', label: 'Processing', description: 'Your order is being prepared', step: 2 },
  { key: 'shipped', label: 'Shipped', description: 'Your order has been shipped', step: 3 },
  { key: 'out_for_delivery', label: 'Out for Delivery', description: 'Your order is out for delivery', step: 4 },
  { key: 'delivered', label: 'Delivered', description: 'Your order has been delivered', step: 5 },
] as const

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned'

function getOrderStep(status: string): number {
  const statusMap: Record<string, number> = {
    pending: 1,
    confirmed: 1,
    processing: 2,
    shipped: 3,
    out_for_delivery: 4,
    delivered: 5,
    cancelled: 0,
    returned: 0,
  }
  return statusMap[status] ?? 0
}

function buildTimeline(orderStatus: OrderStatus, createdAt: Date) {
  const currentStep = getOrderStep(orderStatus)

  if (orderStatus === 'cancelled') {
    return [
      { ...TRACKING_STEPS[0], completed: true, date: createdAt.toISOString(), active: true },
      { key: 'cancelled', label: 'Cancelled', description: 'This order has been cancelled', step: 2, completed: true, date: null, active: false },
    ]
  }

  if (orderStatus === 'returned') {
    return [
      ...TRACKING_STEPS.map((step, idx) => ({
        ...step,
        completed: idx < currentStep,
        date: idx === 0 ? createdAt.toISOString() : null,
        active: idx === currentStep - 1,
      })),
      { key: 'returned', label: 'Returned', description: 'This order has been returned', step: 6, completed: true, date: null, active: false },
    ]
  }

  return TRACKING_STEPS.map((step, idx) => ({
    ...step,
    completed: idx < currentStep,
    date: idx === 0 ? createdAt.toISOString() : null,
    active: idx === currentStep - 1,
  }))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = await getUserIdFromRequest(request)
    const role = await getUserRoleFromRequest(request)
    const body = await request.json()
    const { reason } = body

    const order = await db.order.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Non-admin users can only cancel their own orders
    if (!isAdmin(role) && order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Validate order can be cancelled (not shipped yet)
    const nonCancellableStatuses = ['shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned']
    if (nonCancellableStatuses.includes(order.orderStatus)) {
      return NextResponse.json(
        { success: false, error: `Order cannot be cancelled when status is '${order.orderStatus}'. Only pending, confirmed, or processing orders can be cancelled.` },
        { status: 400 }
      )
    }

    // Update order status to cancelled
    const updatedOrder = await db.order.update({
      where: { id },
      data: {
        orderStatus: 'cancelled',
        orderNote: reason
          ? `${order.orderNote || ''}\nCancellation reason: ${reason}`.trim()
          : order.orderNote,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: {
                  where: { isFeatured: true },
                  take: 1,
                  select: { url: true, alt: true },
                },
              },
            },
          },
        },
        payment: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    // Restore stock for cancelled order items
    for (const item of order.items) {
      await db.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } }
      })
    }

    // Build tracking timeline for cancelled order
    const timeline = buildTimeline(updatedOrder.orderStatus as OrderStatus, updatedOrder.createdAt)

    const trackingDetails = {
      currentStatus: updatedOrder.orderStatus,
      currentStep: getOrderStep(updatedOrder.orderStatus),
      totalSteps: 5,
      timeline,
      trackingNumber: updatedOrder.orderNumber,
      carrier: 'Khati Khadyo Delivery',
    }

    // Enhance items with product images
    const enhancedItems = updatedOrder.items.map((item) => ({
      ...item,
      product: item.product ? {
        ...item.product,
        image: item.product.images[0]?.url || null,
        imageAlt: item.product.images[0]?.alt || item.product.name,
      } : null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        ...updatedOrder,
        items: enhancedItems,
        tracking: trackingDetails,
        cancellationReason: reason || null,
      },
    })
  } catch (error) {
    console.error('Cancel order error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
