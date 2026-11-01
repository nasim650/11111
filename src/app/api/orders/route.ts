import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, getUserIdFromRequest, getUserFromRequest, isAdmin, getPaginationParams, paginatedResponse, generateOrderNumber } from '@/lib/utils'
import { validateCheckout, validationError } from '@/lib/validation'
import { appendPaymentLog } from '@/lib/sslcommerz'
import { getShippingSettings } from '@/lib/shipping'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const role = await getUserRoleFromRequest(request)
    const userId = await getUserIdFromRequest(request)
    const { page, limit, skip } = getPaginationParams(url)

    const orderStatus = url.searchParams.get('orderStatus')
    const paymentStatus = url.searchParams.get('paymentStatus')

    const where: Record<string, unknown> = {}

    // Non-admin users can only see their own orders
    if (!isAdmin(role) && userId) {
      where.userId = userId
    } else if (!isAdmin(role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (orderStatus) where.orderStatus = orderStatus
    if (paymentStatus) where.paymentStatus = paymentStatus

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          items: true,
          payment: true,
          deliveryLabel: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.order.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: paginatedResponse(orders, total, page, limit),
    })
  } catch (error) {
    console.error('Get orders error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = validateCheckout(body)
    if (!validated.ok) {
      return NextResponse.json(
        validationError(validated.errors),
        { status: 400 }
      )
    }
    const {
      userId, guestName, guestPhone, guestEmail, guestAddress,
      items,
      paymentMethod, orderNote, couponCode,
      addressId, shippingMethod,
      loyaltyPoints: loyaltyPointsToRedeem,
    } = validated.data

    if (userId) {
      const authUser = await getUserFromRequest(request)
      if (!authUser) {
        return NextResponse.json(
          { success: false, error: 'Authentication required for user checkout' },
          { status: 401 }
        )
      }
      if (authUser.role !== 'admin' && authUser.role !== 'manager' && authUser.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: you can only create orders for yourself' },
          { status: 403 }
        )
      }
    }

    // Get address if addressId provided
    let shippingAddress: Record<string, unknown> | null = null
    if (addressId && userId) {
      const address = await db.address.findFirst({ where: { id: addressId, userId } })
      if (!address) {
        return NextResponse.json(
          { success: false, error: 'Delivery address not found' },
          { status: 400 }
        )
      }
      shippingAddress = {
        name: address.name,
        phone: address.phone,
        address: address.address,
        city: address.city,
        district: address.district,
        postalCode: address.postalCode,
      }
    }

    // Verify prices server-side
    let subtotal = 0
    const verifiedItems: Array<{
      productId: string
      productName: string
      quantity: number
      unit: string
      price: number
      image: string | null
    }> = []

    // Batch fetch products to avoid N+1 query and verify images server-side
    const productIds = items.map((i) => i.productId)
    const fetchedProducts = await db.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        price: true,
        discountPrice: true,
        stock: true,
        unit: true,
        status: true,
        images: { take: 1, orderBy: { sortOrder: 'asc' } },
      },
    })
    const productMap = new Map(fetchedProducts.map((p) => [p.id, p]))

    for (const item of items) {
      const product = productMap.get(item.productId)

      if (!product || product.status !== 'active') {
        return NextResponse.json(
          { success: false, error: `Product ${item.productId} not available` },
          { status: 400 }
        )
      }

      if (product.stock < item.quantity) {
        return NextResponse.json(
          { success: false, error: `Insufficient stock for ${product.name}` },
          { status: 400 }
        )
      }

      const itemPrice = product.discountPrice != null ? product.discountPrice : product.price
      const itemTotal = itemPrice * item.quantity
      subtotal += itemTotal

      verifiedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unit: product.unit,
        price: itemPrice,
        image: product.images[0]?.url || item.image || null,
      })
    }

    // ─── Calculate delivery charge server-side (from canonical settings) ────────
    const shippingSettings = await getShippingSettings()
    const freeShippingThreshold = shippingSettings.freeShippingThreshold
    const standardDeliveryCharge = shippingSettings.standardDeliveryCharge
    const expressDeliveryCharge = shippingSettings.expressDeliveryCharge

    let deliveryCharge = standardDeliveryCharge
    if (subtotal >= freeShippingThreshold) {
      deliveryCharge = 0
    }
    // If express delivery selected
    if (shippingMethod === 'express') {
      deliveryCharge = expressDeliveryCharge
      if (subtotal >= freeShippingThreshold) {
        deliveryCharge = expressDeliveryCharge - standardDeliveryCharge // only pay difference
      }
    }

    // ─── Calculate discount server-side from coupon ──────────────────────
    let discountAmount = 0
    let validatedCouponCode: string | null = null
    if (couponCode) {
      const coupon = await db.coupon.findFirst({
        where: {
          code: couponCode,
          isActive: true,
          validFrom: { lte: new Date() },
          validTo: { gte: new Date() },
        }
      })
      if (coupon) {
        if (coupon.minOrder && subtotal < coupon.minOrder) {
          return NextResponse.json(
            { success: false, error: `Coupon requires minimum order of ৳${coupon.minOrder}` },
            { status: 400 }
          )
        } else if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          return NextResponse.json(
            { success: false, error: 'Coupon usage limit has been reached' },
            { status: 400 }
          )
        } else {
          if (coupon.type === 'percentage') {
            discountAmount = Math.round((subtotal * coupon.value) / 100)
            if (coupon.maxDiscount) {
              discountAmount = Math.min(discountAmount, coupon.maxDiscount)
            }
          } else {
            discountAmount = coupon.value
          }
          validatedCouponCode = coupon.code

        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired coupon code' },
          { status: 400 }
        )
      }
    }

    // ─── Recalculate total with server-side values ──────────────────────
    let loyaltyDiscount = 0
    let loyaltyRedeemedPoints = 0

    // Validate and calculate loyalty points discount
    if (loyaltyPointsToRedeem && loyaltyPointsToRedeem > 0 && userId) {
      const maxLoyaltyDiscount = Math.floor(subtotal * 0.2) // Max 20% of subtotal
      const requestedDiscount = Math.min(loyaltyPointsToRedeem, maxLoyaltyDiscount)

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { loyaltyBalance: true },
      })

      if (user && user.loyaltyBalance >= requestedDiscount) {
        loyaltyDiscount = requestedDiscount
        loyaltyRedeemedPoints = requestedDiscount
      } else if (user && user.loyaltyBalance > 0) {
        // Use whatever points they have up to the max
        loyaltyDiscount = Math.min(user.loyaltyBalance, maxLoyaltyDiscount)
        loyaltyRedeemedPoints = loyaltyDiscount
      }
    }

    const totalAmount = subtotal + deliveryCharge - discountAmount - loyaltyDiscount

    // Validate total amount is positive
    if (totalAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Order total must be greater than zero after all discounts' },
        { status: 400 }
      )
    }

    const orderNumber = generateOrderNumber()
    const invoiceNumber = `INV-${orderNumber}`

    // Wrap order creation in transaction so stock deductions roll back on failure
    const order = await db.$transaction(async (tx) => {
      // Deduct stock atomically for each item
      for (const item of verifiedItems) {
        const result = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        })
        if (result.count === 0) {
          throw new Error(`Insufficient stock for ${item.productName}`)
        }
      }

      // Increment coupon usage if applicable
      if (validatedCouponCode) {
        await tx.coupon.updateMany({
          where: { code: validatedCouponCode, isActive: true },
          data: { usedCount: { increment: 1 } },
        })
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          invoiceNumber,
          userId: userId || null,
          guestName: guestName || (shippingAddress?.name as string) || null,
          guestPhone: guestPhone || (shippingAddress?.phone as string) || null,
          guestEmail,
          guestAddress: guestAddress || (shippingAddress ? `${(shippingAddress as Record<string, string>).address}, ${(shippingAddress as Record<string, string>).city}` : null),
          totalAmount,
          discountAmount,
          loyaltyDiscountAmount: loyaltyDiscount,
          deliveryCharge,
          paymentMethod,
          paymentStatus: 'pending',
          orderNote,
          couponCode: validatedCouponCode,
          items: {
            create: verifiedItems.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unit: item.unit,
              price: parseFloat(String(item.price)),
              image: item.image || null,
            })),
          },
        },
        include: { items: true },
      })

      if (paymentMethod === 'online') {
        await tx.payment.create({
          data: {
            orderId: order.id,
            userId: userId || null,
            method: 'online',
            gateway: 'sslcommerz',
            status: 'pending',
            amount: totalAmount,
            gatewayResponse: appendPaymentLog(null, {
              event: 'order_created',
              status: 'pending',
              message: 'Awaiting SSLCOMMERZ session initiation',
            }),
          },
        })
      }

      // Clear cart for this user after order
      if (userId) {
        await tx.cartItem.deleteMany({ where: { userId } })
      }

      // Create delivery label
      await tx.deliveryLabel.create({
        data: {
          orderId: order.id,
          customerName: order.guestName || '',
          phone: order.guestPhone || '',
          address: order.guestAddress || '',
          productSummary: order.items.map((i) => `${i.productName} x${i.quantity}`).join(', '),
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
        },
      })
      // Create initial status history entry
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'pending',
          note: 'Order placed successfully',
          changedBy: userId || null,
        },
      })

      // ─── Deduct loyalty points if redeemed at checkout ─────────────────
      if (loyaltyRedeemedPoints > 0 && userId) {
        const userBalance = await tx.user.findUnique({
          where: { id: userId },
          select: { loyaltyBalance: true },
        })

        if (userBalance) {
          const newBalance = userBalance.loyaltyBalance - loyaltyRedeemedPoints
          await tx.loyaltyPoint.create({
            data: {
              userId,
              points: -loyaltyRedeemedPoints,
              balance: newBalance,
              type: 'redeem',
              description: `Redeemed ${loyaltyRedeemedPoints} points at checkout (৳${loyaltyRedeemedPoints} discount)`,
              orderId: order.id,
            },
          })
          await tx.user.update({
            where: { id: userId },
            data: { loyaltyBalance: newBalance },
          })
        }
      }

      return order
    })



    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
