import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeCouponCode, numberInRange } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, orderAmount } = body
    const couponCode = normalizeCouponCode(code)
    const amount = orderAmount === undefined || orderAmount === null || orderAmount === ''
      ? 0
      : numberInRange(orderAmount, 0, 10000000)

    if (!couponCode) {
      return NextResponse.json(
        { success: false, error: 'Valid coupon code is required' },
        { status: 400 }
      )
    }

    if (amount === null) {
      return NextResponse.json(
        { success: false, error: 'Order amount must be a valid amount' },
        { status: 400 }
      )
    }

    const coupon = await db.coupon.findUnique({
      where: { code: couponCode },
    })

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: 'Invalid coupon code' },
        { status: 404 }
      )
    }

    const now = new Date()

    if (!coupon.isActive) {
      return NextResponse.json(
        { success: false, error: 'Coupon is not active' },
        { status: 400 }
      )
    }

    if (now < coupon.validFrom || now > coupon.validTo) {
      return NextResponse.json(
        { success: false, error: 'Coupon has expired or is not yet valid' },
        { status: 400 }
      )
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json(
        { success: false, error: 'Coupon usage limit has been reached' },
        { status: 400 }
      )
    }

    if (coupon.minOrder && amount < coupon.minOrder) {
      return NextResponse.json(
        { success: false, error: `Minimum order amount is ${coupon.minOrder}` },
        { status: 400 }
      )
    }

    let discount = 0
    if (coupon.type === 'percentage') {
      discount = amount * (coupon.value / 100)
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount
      }
    } else {
      discount = coupon.value
    }

    return NextResponse.json({
      success: true,
      data: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount: Math.round(discount * 100) / 100,
        minOrder: coupon.minOrder,
        maxDiscount: coupon.maxDiscount,
      },
    })
  } catch (error) {
    console.error('Validate coupon error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
