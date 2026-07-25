import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin } from '@/lib/utils'
import { validateCoupon, validationError } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const coupons = await db.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: coupons })
  } catch (error) {
    console.error('Get coupons error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = validateCoupon(body)
    if (!validated.ok) {
      return NextResponse.json(
        validationError(validated.errors),
        { status: 400 }
      )
    }

    const coupon = await db.coupon.create({
      data: {
        code: validated.data.code as string,
        type: validated.data.type as string,
        value: validated.data.value as number,
        minOrder: (validated.data.minOrder as number | null | undefined) ?? null,
        maxDiscount: (validated.data.maxDiscount as number | null | undefined) ?? null,
        usageLimit: (validated.data.usageLimit as number | null | undefined) ?? null,
        validFrom: validated.data.validFrom as Date,
        validTo: validated.data.validTo as Date,
        isActive: (validated.data.isActive as boolean | undefined) ?? true,
      },
    })

    return NextResponse.json({ success: true, data: coupon }, { status: 201 })
  } catch (error) {
    console.error('Create coupon error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
