import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin } from '@/lib/utils'
import { validateCoupon, validationError } from '@/lib/validation'

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
    const validated = validateCoupon(body, true)
    if (!validated.ok) {
      return NextResponse.json(
        validationError(validated.errors),
        { status: 400 }
      )
    }

    const coupon = await db.coupon.update({ where: { id }, data: validated.data })

    return NextResponse.json({ success: true, data: coupon })
  } catch (error) {
    console.error('Update coupon error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
    await db.coupon.delete({ where: { id } })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete coupon error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
