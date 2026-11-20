import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, getUserIdFromRequest, getUserFromRequest, isAdmin, getPaginationParams, paginatedResponse, generateOrderNumber } from '@/lib/utils'
import { validateCheckout, validationError, normalizePhone } from '@/lib/validation'
import { appendPaymentLog } from '@/lib/sslcommerz'
import { getShippingSettings } from '@/lib/shipping'
import { getReservationExpiry } from '@/lib/order-inventory'
import { verifyCheckoutProof } from '@/lib/checkout-proof'

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

export class OrderBusinessError extends Error {
  statusCode: number
  code: string
  constructor(message: string, statusCode = 400, code = 'ORDER_BUSINESS_ERROR') {
    super(message)
    this.name = 'OrderBusinessError'
    this.statusCode = statusCode
    this.code = code
  }
}

async function getOrCreateGuestUser(
  rawGuestPhone: string,
  guestName?: string | null,
  guestEmail?: string | null
): Promise<string | null> {
  const normalizedPhone = normalizePhone(rawGuestPhone) || rawGuestPhone.trim()
  if (!normalizedPhone) return null

  try {
    const existing = await db.user.findFirst({
      where: { phone: normalizedPhone },
    })

    if (existing) {
      if (!existing.isVerified) {
        await db.user.update({
          where: { id: existing.id },
          data: { isVerified: true },
        }).catch((err) => {
          console.warn('Could not update guest user isVerified flag:', err)
        })
      }
      return existing.id
    }

    let safeEmail: string | null = null
    if (guestEmail && guestEmail.trim()) {
      const normalizedEmail = guestEmail.trim().toLowerCase()
      const existingEmail = await db.user.findFirst({
        where: { email: normalizedEmail },
      })
      if (!existingEmail) {
        safeEmail = normalizedEmail
      }
    }

    const created = await db.user.create({
      data: {
        phone: normalizedPhone,
        name: guestName?.trim() || 'Guest Customer',
        email: safeEmail,
        password: null,
        role: 'customer',
        isVerified: true,
      },
    })
    return created.id
  } catch (err: any) {
    if (err?.code === 'P2002') {
      try {
        const found = await db.user.findFirst({
          where: { phone: normalizedPhone },
        })
        if (found) return found.id

        const fallback = await db.user.create({
          data: {
            phone: normalizedPhone,
            name: guestName?.trim() || 'Guest Customer',
            email: null,
            password: null,
            role: 'customer',
            isVerified: true,
          },
        })
        return fallback.id
      } catch (fallbackErr) {
        console.warn('Could not resolve guest user on P2002 collision:', fallbackErr)
      }
    }
    console.error('Failed to get or create guest user profile:', err)
    return null
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
      checkoutProof,
    } = validated.data

    let customer: { id: string; name: string | null; email: string | null; phone: string | null; isVerified: boolean; role: string } | null = null

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

      // Checkout security rule: Logged-in customer must have a verified phone number
      customer = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, phone: true, isVerified: true, role: true },
      })
      if (!customer) {
        return NextResponse.json(
          { success: false, error: 'User account not found' },
          { status: 404 }
        )
      }
      if (customer.role === 'customer') {
        if (!customer.phone || !customer.isVerified) {
          return NextResponse.json(
            {
              success: false,
              error: 'অর্ডার সম্পন্ন করতে অনুগ্রহ করে আপনার মোবাইল নম্বর ভেরিফাই করুন। (Please verify your mobile number to complete the order)',
              code: 'PHONE_UNVERIFIED',
              requiresPhoneVerification: true,
              hasPhone: Boolean(customer.phone),
            },
            { status: 403 }
          )
        }
      }
    } else {
      // Guest Checkout Security Enforcement:
      // Guest MUST provide valid, cryptographically verified checkout proof matching guestPhone
      const isVerifiedGuest = Boolean(checkoutProof && verifyCheckoutProof(checkoutProof, guestPhone))
      if (!isVerifiedGuest) {
        return NextResponse.json(
          {
            success: false,
            error: 'অর্ডার সম্পন্ন করতে অনুগ্রহ করে মোবাইল নম্বর ওটিপি দিয়ে ভেরিফাই করুন। (Please verify your mobile number with OTP to complete your order)',
            code: 'PHONE_UNVERIFIED',
            requiresPhoneVerification: true,
          },
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

    // Log price manipulation attempt if client provided totalAmount that differs
    if (body.totalAmount !== undefined && Math.abs(Number(body.totalAmount) - totalAmount) > 0.01) {
      console.warn(`[SECURITY] Price manipulation attempt detected on checkout. Client sent ${body.totalAmount}, authoritative server total is ${totalAmount}`)
    }

    // Validate total amount is positive
    if (totalAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Order total must be greater than zero after all discounts' },
        { status: 400 }
      )
    }

    const orderNumber = generateOrderNumber()
    const invoiceNumber = `INV-${orderNumber}`

    // Generate secure opaque guest access token if guest order
    let rawGuestToken: string | null = null
    let guestAccessTokenHash: string | null = null
    let guestAccessExpiresAt: Date | null = null
    let effectiveUserId: string | null = userId || null

    if (!userId) {
      rawGuestToken = crypto.randomBytes(32).toString('hex')
      guestAccessTokenHash = crypto.createHash('sha256').update(rawGuestToken).digest('hex')
      guestAccessExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      // Part C: Universal Phone Verification Identity
      // Guest customer: phone OTP verified proof required at checkout.
      // On verification, create/reuse phone identity customer profile (password: null, role: 'customer', isVerified: true).
      // Link order to profile without crashing on unique collisions.
      if (guestPhone) {
        effectiveUserId = await getOrCreateGuestUser(guestPhone, guestName, guestEmail)
      }
    }

    // Resolve address and customer details cleanly for order & delivery label
    let resolvedOrderAddress: string | null = null
    if (guestAddress && guestAddress.trim()) {
      resolvedOrderAddress = guestAddress.trim()
    } else if (shippingAddress) {
      const addrStr = (shippingAddress.address as string)?.trim() || ''
      const cityStr = (shippingAddress.city as string)?.trim() || ''
      if (addrStr.includes('__BDMETA__') || !cityStr) {
        resolvedOrderAddress = addrStr
      } else {
        resolvedOrderAddress = `${addrStr}, ${cityStr}`
      }
    }

    const resolvedCustomerName = (guestName?.trim() || (shippingAddress?.name as string) || customer?.name || 'Customer').trim()
    const resolvedCustomerPhone = (guestPhone?.trim() || (shippingAddress?.phone as string) || customer?.phone || '').trim()

    // Wrap order creation in transaction so stock deductions roll back on failure
    const order = await db.$transaction(
      async (tx) => {
        // Deduct stock atomically for each item
        for (const item of verifiedItems) {
          const result = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          })
          if (result.count === 0) {
            throw new OrderBusinessError(
              `পণ্যের পর্যাপ্ত স্টক নেই (${item.productName}) / Insufficient stock for ${item.productName}`,
              400,
              'INSUFFICIENT_STOCK'
            )
          }
        }

        // Increment coupon usage if applicable
        if (validatedCouponCode) {
          const lockedCoupon = await tx.coupon.findUnique({
            where: { code: validatedCouponCode },
            select: {
              isActive: true,
              validFrom: true,
              validTo: true,
              usedCount: true,
              usageLimit: true,
            },
          })
          const now = new Date()
          if (
            !lockedCoupon ||
            !lockedCoupon.isActive ||
            lockedCoupon.validFrom > now ||
            lockedCoupon.validTo < now ||
            (lockedCoupon.usageLimit !== null && lockedCoupon.usedCount >= lockedCoupon.usageLimit)
          ) {
            throw new OrderBusinessError(
              'Coupon is no longer available',
              400,
              'COUPON_UNAVAILABLE'
            )
          }

          const usageClaim = await tx.coupon.updateMany({
            where: {
              code: validatedCouponCode,
              isActive: true,
              usedCount: lockedCoupon.usedCount,
            },
            data: { usedCount: { increment: 1 } },
          })
          if (usageClaim.count === 0) {
            throw new OrderBusinessError(
              'Coupon was just used by another order',
              409,
              'COUPON_CONFLICT'
            )
          }
        }

        const order = await tx.order.create({
          data: {
            orderNumber,
            invoiceNumber,
            userId: effectiveUserId,
            guestName: resolvedCustomerName || null,
            guestPhone: resolvedCustomerPhone || null,
            guestEmail: guestEmail || customer?.email || null,
            guestAddress: resolvedOrderAddress,
            guestAccessTokenHash,
            guestAccessExpiresAt,
            totalAmount,
            discountAmount,
            loyaltyDiscountAmount: loyaltyDiscount,
            deliveryCharge,
            paymentMethod,
            paymentStatus: 'pending',
            reservationExpiresAt: getReservationExpiry(paymentMethod),
            stockReserved: true,
            couponReleased: false,
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
              userId: effectiveUserId,
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
            customerName: order.guestName || resolvedCustomerName || 'Customer',
            phone: order.guestPhone || resolvedCustomerPhone || 'N/A',
            address: order.guestAddress || resolvedOrderAddress || 'N/A',
            productSummary: order.items && order.items.length > 0
              ? order.items.map((i) => `${i.productName} x${i.quantity}`).join(', ')
              : 'Order items',
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
          const balanceUpdate = await tx.user.updateMany({
            where: {
              id: userId,
              loyaltyBalance: { gte: loyaltyRedeemedPoints },
            },
            data: {
              loyaltyBalance: { decrement: loyaltyRedeemedPoints },
            },
          })

          if (balanceUpdate.count === 0) {
            throw new OrderBusinessError(
              'Insufficient loyalty points',
              400,
              'INSUFFICIENT_LOYALTY_POINTS'
            )
          }

          const updatedUser = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { loyaltyBalance: true },
          })
          await tx.loyaltyPoint.create({
            data: {
              userId,
              points: -loyaltyRedeemedPoints,
              balance: updatedUser.loyaltyBalance,
              type: 'redeem',
              description: `Redeemed ${loyaltyRedeemedPoints} points at checkout (৳${loyaltyRedeemedPoints} discount)`,
              orderId: order.id,
            },
          })
        }

        return order
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    )

    const response = NextResponse.json(
      {
        success: true,
        data: order,
        ...(rawGuestToken ? { guestAccessToken: rawGuestToken } : {}),
      },
      { status: 201 }
    )

    if (rawGuestToken) {
      const isProd = process.env.NODE_ENV === 'production'
      response.cookies.set('guest_order_access', rawGuestToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600,
      })
      response.cookies.set(`guest_order_${order.orderNumber}`, rawGuestToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600,
      })
    }

    return response
  } catch (error: any) {
    // 1. Business logic validation error thrown deliberately
    if (error instanceof OrderBusinessError || error?.name === 'OrderBusinessError') {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code || 'BUSINESS_ERROR',
        },
        { status: error.statusCode || 400 }
      )
    }

    // Check if error message indicates insufficient stock
    if (typeof error?.message === 'string' && error.message.includes('Insufficient stock')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: 'INSUFFICIENT_STOCK',
        },
        { status: 400 }
      )
    }

    // 2. Prisma Known Request Errors
    if (error?.code) {
      console.error('[DATABASE ERROR in POST /api/orders]:', {
        code: error.code,
        meta: error.meta,
        message: error.message,
      })

      switch (error.code) {
        case 'P2002': {
          // Unique constraint violation (e.g. orderNumber collision)
          return NextResponse.json(
            {
              success: false,
              error: 'অর্ডার প্রক্রিয়াকরণে দ্বন্দ্ব তৈরি হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন। (Order conflict, please retry)',
              code: 'ORDER_CONFLICT',
              meta: error.meta?.target,
            },
            { status: 409 }
          )
        }
        case 'P2028': {
          // Transaction timeout (pool exhaustion or network latency)
          return NextResponse.json(
            {
              success: false,
              error: 'সার্ভার ব্যস্ত রয়েছে, অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন। (Server busy, please retry in a moment)',
              code: 'TRANSACTION_TIMEOUT',
            },
            { status: 503 }
          )
        }
        case 'P2022': {
          // Column missing in database (migration missing)
          console.error(
            '[DATABASE CONFIGURATION ERROR] A required column is missing in the database (P2022). ' +
            'Please run "npx prisma migrate deploy" against the target database.\n' +
            `Details: ${error.message}`
          )
          return NextResponse.json(
            {
              success: false,
              error: 'ডাটাবেজ কনফিগারেশন ত্রুটি, অ্যাডমিনের সাথে যোগাযোগ করুন। (Database schema error, please contact administrator)',
              code: 'DATABASE_SCHEMA_ERROR',
            },
            { status: 500 }
          )
        }
        case 'P2003': {
          // Foreign key violation
          return NextResponse.json(
            {
              success: false,
              error: 'অর্ডারের সাথে যুক্ত কোনো তথ্য খুঁজে পাওয়া যায়নি। (Referenced record not found)',
              code: 'INVALID_REFERENCE',
            },
            { status: 400 }
          )
        }
        case 'P2025': {
          // Record not found
          return NextResponse.json(
            {
              success: false,
              error: 'পণ্য বা রেকর্ড খুঁজে পাওয়া যায়নি। (Record not found)',
              code: 'RECORD_NOT_FOUND',
            },
            { status: 404 }
          )
        }
      }
    }

    console.error('Unhandled Create order error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'অর্ডার সম্পন্ন করতে সমস্যা হয়েছে, অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন। (Internal server error)',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}
