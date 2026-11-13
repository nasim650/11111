import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cleanText, normalizeCouponCode } from '@/lib/validation'
import { getShippingSettings } from '@/lib/shipping'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = cleanText(body.userId, 80)
    const sessionId = cleanText(body.sessionId, 120)
    const couponCode = normalizeCouponCode(body.couponCode)

    if (!couponCode || (!userId && !sessionId)) {
      return NextResponse.json(
        { success: false, error: 'Valid couponCode and userId/sessionId are required' },
        { status: 400 }
      )
    }

    // Find the coupon
    const coupon = await db.coupon.findUnique({
      where: { code: couponCode },
    })

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: 'Invalid coupon code' },
        { status: 404 }
      )
    }

    // Validate coupon is active
    if (!coupon.isActive) {
      return NextResponse.json(
        { success: false, error: 'This coupon is no longer active' },
        { status: 400 }
      )
    }

    // Validate coupon hasn't expired
    const now = new Date()
    if (coupon.validTo && new Date(coupon.validTo) < now) {
      return NextResponse.json(
        { success: false, error: 'This coupon has expired' },
        { status: 400 }
      )
    }

    // Validate coupon has started
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return NextResponse.json(
        { success: false, error: 'This coupon is not yet active' },
        { status: 400 }
      )
    }

    // Validate usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json(
        { success: false, error: 'This coupon has reached its usage limit' },
        { status: 400 }
      )
    }

    // Get cart items to calculate subtotal
    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId
    if (sessionId) where.sessionId = sessionId

    const cartItems = await db.cartItem.findMany({
      where,
      include: {
        product: {
          select: { price: true, discountPrice: true },
        },
      },
    })

    if (cartItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cart is empty' },
        { status: 400 }
      )
    }

    // Calculate subtotal
    let subtotal = 0
    for (const item of cartItems) {
      const price = item.product.discountPrice ?? item.product.price
      subtotal += price * item.quantity
    }

    // Check minimum order amount
    if (coupon.minOrder && subtotal < coupon.minOrder) {
      return NextResponse.json(
        { success: false, error: `Minimum order amount of ৳${coupon.minOrder} required for this coupon` },
        { status: 400 }
      )
    }

    // Calculate discount
    let discountAmount = 0
    if (coupon.type === 'percentage') {
      discountAmount = (subtotal * coupon.value) / 100
      // Apply max discount cap
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount
      }
    } else if (coupon.type === 'fixed') {
      discountAmount = coupon.value
    }

    // Discount cannot exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal)
    discountAmount = Math.round(discountAmount * 100) / 100

    // Get shipping cost from canonical source
    const shippingSettings = await getShippingSettings()
    const freeShippingThreshold = shippingSettings.freeShippingThreshold
    const shippingCharge = shippingSettings.standardDeliveryCharge
    const shipping = subtotal >= freeShippingThreshold ? 0 : shippingCharge

    const total = Math.round((subtotal + shipping - discountAmount) * 100) / 100

    // Increment coupon usage
    await db.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    })

    return NextResponse.json({
      success: true,
      data: {
        coupon: {
          id: coupon.id,
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
        },
        discountAmount,
        subtotal: Math.round(subtotal * 100) / 100,
        shipping: Math.round(shipping * 100) / 100,
        total,
      },
    })
  } catch (error) {
    console.error('Apply coupon error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
