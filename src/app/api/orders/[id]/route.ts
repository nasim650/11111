import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, getUserIdFromRequest, isAdmin } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

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

function getEstimatedDeliveryDate(orderDate: Date): { min: string; max: string } {
  const minDate = new Date(orderDate)
  const maxDate = new Date(orderDate)

  // Add 3-5 business days
  let addedDays = 0
  let minDays = 0
  let maxDays = 0

  // Calculate 3 business days
  const tempMin = new Date(orderDate)
  addedDays = 0
  while (minDays < 3) {
    tempMin.setDate(tempMin.getDate() + 1)
    addedDays++
    const dayOfWeek = tempMin.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Saturday or Sunday
      minDays++
    }
  }

  // Calculate 5 business days
  const tempMax = new Date(orderDate)
  addedDays = 0
  while (maxDays < 5) {
    tempMax.setDate(tempMax.getDate() + 1)
    addedDays++
    const dayOfWeek = tempMax.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      maxDays++
    }
  }

  minDate.setTime(tempMin.getTime())
  maxDate.setTime(tempMax.getTime())

  return {
    min: minDate.toISOString().split('T')[0],
    max: maxDate.toISOString().split('T')[0],
  }
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
        deliveryLabel: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Non-admin users can only see their own orders
    if (!isAdmin(role) && order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Build tracking details
    const timeline = buildTimeline(order.orderStatus as OrderStatus, order.createdAt)
    const estimatedDelivery = getEstimatedDeliveryDate(order.createdAt)

    const trackingDetails = {
      currentStatus: order.orderStatus,
      currentStep: getOrderStep(order.orderStatus),
      totalSteps: 5,
      timeline,
      estimatedDelivery,
      trackingNumber: order.orderNumber,
      carrier: 'Khati Khadyo Delivery',
      shippedAt: getOrderStep(order.orderStatus) >= 3 ? order.updatedAt.toISOString() : null,
    }

    // Enhance order items with product images
    const enhancedItems = order.items.map((item) => ({
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
        ...order,
        items: enhancedItems,
        tracking: trackingDetails,
      },
    })
  } catch (error) {
    console.error('Get order error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { orderStatus, paymentStatus, orderNote } = body

    // Fetch current order to check for cancellation
    const currentOrder = await db.order.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!currentOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    const data: Record<string, unknown> = {}
    if (orderStatus !== undefined) data.orderStatus = orderStatus
    if (paymentStatus !== undefined) data.paymentStatus = paymentStatus
    if (orderNote !== undefined) data.orderNote = orderNote

    const order = await db.order.update({
      where: { id },
      data,
      include: { items: true, deliveryLabel: true },
    })

    // Create status history entry when status changes
    if (orderStatus && orderStatus !== currentOrder.orderStatus) {
      const adminId = await getUserIdFromRequest(request)
      await db.orderStatusHistory.create({
        data: {
          orderId: id,
          status: orderStatus,
          note: `Status changed from ${currentOrder.orderStatus} to ${orderStatus}`,
          changedBy: adminId || null,
        },
      })
    }

    // ─── Auto-earn loyalty points when order is delivered ──────────────────
    if (orderStatus === 'delivered' && currentOrder.orderStatus !== 'delivered' && currentOrder.userId) {
      try {
        const orderTotal = currentOrder.totalAmount
        const pointsEarned = Math.floor(orderTotal / 100) // 1 point per ৳100

        if (pointsEarned > 0) {
          const user = await db.user.findUnique({
            where: { id: currentOrder.userId },
            select: { loyaltyBalance: true },
          })

          if (user) {
            // Check if this is the user's first loyalty point entry (welcome bonus)
            const existingPoints = await db.loyaltyPoint.count({
              where: { userId: currentOrder.userId },
            })

            const newBalance = user.loyaltyBalance + pointsEarned

            await db.$transaction(async (tx) => {
              // Welcome bonus of 50 points for first-time earners
              if (existingPoints === 0) {
                await tx.loyaltyPoint.create({
                  data: {
                    userId: currentOrder.userId!,
                    points: 50,
                    balance: user.loyaltyBalance + 50,
                    type: 'bonus',
                    description: 'Welcome bonus - First purchase reward!',
                    orderId: id,
                  },
                })
                await tx.user.update({
                  where: { id: currentOrder.userId! },
                  data: { loyaltyBalance: user.loyaltyBalance + 50 },
                })

                // Now create the earn entry with updated balance
                await tx.loyaltyPoint.create({
                  data: {
                    userId: currentOrder.userId!,
                    points: pointsEarned,
                    balance: user.loyaltyBalance + 50 + pointsEarned,
                    type: 'earn',
                    description: `Earned ${pointsEarned} points from order ৳${Math.round(orderTotal).toLocaleString()}`,
                    orderId: id,
                  },
                })
                await tx.user.update({
                  where: { id: currentOrder.userId! },
                  data: { loyaltyBalance: user.loyaltyBalance + 50 + pointsEarned },
                })
              } else {
                await tx.loyaltyPoint.create({
                  data: {
                    userId: currentOrder.userId!,
                    points: pointsEarned,
                    balance: newBalance,
                    type: 'earn',
                    description: `Earned ${pointsEarned} points from order ৳${Math.round(orderTotal).toLocaleString()}`,
                    orderId: id,
                  },
                })
                await tx.user.update({
                  where: { id: currentOrder.userId! },
                  data: { loyaltyBalance: newBalance },
                })
              }
            })
          }
        }
      } catch (loyaltyError) {
        // Log but don't fail the order update
        console.error('Loyalty points earning error (non-blocking):', loyaltyError)
      }
    }

    // Restore stock when order is cancelled
    if (orderStatus === 'cancelled' && currentOrder.orderStatus !== 'cancelled') {
      for (const item of currentOrder.items) {
        await db.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        })
      }
    }

    // Audit log
    const adminId = await getUserIdFromRequest(request)
    await createAuditLog({
      adminId: adminId ?? undefined,
      action: 'update',
      module: 'orders',
      referenceId: id,
      newData: { orderStatus: order.orderStatus, paymentStatus: order.paymentStatus, orderNote: order.orderNote },
    })

    // Update delivery label if order status changes
    if (orderStatus && order.deliveryLabel) {
      await db.deliveryLabel.update({
        where: { orderId: id },
        data: { paymentStatus: order.paymentStatus },
      })
    }

    // Build tracking details for the updated order
    const timeline = buildTimeline(order.orderStatus as OrderStatus, order.createdAt)
    const estimatedDelivery = getEstimatedDeliveryDate(order.createdAt)

    const trackingDetails = {
      currentStatus: order.orderStatus,
      currentStep: getOrderStep(order.orderStatus),
      totalSteps: 5,
      timeline,
      estimatedDelivery,
      trackingNumber: order.orderNumber,
      carrier: 'Khati Khadyo Delivery',
    }

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        tracking: trackingDetails,
      },
    })
  } catch (error) {
    console.error('Update order error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
