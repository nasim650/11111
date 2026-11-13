import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShippingSettings } from '@/lib/shipping'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, sessionId } = body

    if (!userId && !sessionId) {
      return NextResponse.json(
        { success: false, error: 'userId or sessionId is required' },
        { status: 400 }
      )
    }

    // Get cart items to recalculate totals without coupon
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

    // Recalculate subtotal and shipping without discount
    let subtotal = 0
    for (const item of cartItems) {
      const price = item.product.discountPrice ?? item.product.price
      subtotal += price * item.quantity
    }

    const shippingSettings = await getShippingSettings()
    const freeShippingThreshold = shippingSettings.freeShippingThreshold
    const shippingCharge = shippingSettings.standardDeliveryCharge
    const shipping = subtotal >= freeShippingThreshold ? 0 : shippingCharge
    const total = Math.round((subtotal + shipping) * 100) / 100

    return NextResponse.json({
      success: true,
      data: {
        discountAmount: 0,
        subtotal: Math.round(subtotal * 100) / 100,
        shipping: Math.round(shipping * 100) / 100,
        total,
        couponRemoved: true,
      },
    })
  } catch (error) {
    console.error('Remove coupon error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
