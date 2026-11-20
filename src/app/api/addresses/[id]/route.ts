import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/utils'
import { validateAddressParts, validationError } from '@/lib/validation'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { isDefault, userId } = body

    // Ownership check: non-admin users can only update their own addresses
    const existingAddr = await db.address.findUnique({ where: { id }, select: { userId: true, name: true, phone: true, address: true, city: true, district: true, postalCode: true } })
    if (!existingAddr) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      )
    }

    if (authUser.role !== 'admin' && authUser.role !== 'manager') {
      if (existingAddr.userId !== authUser.userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: you can only update your own addresses' },
          { status: 403 }
        )
      }
    }

    // Merge with existing for validation
    const toValidate = {
      name: body.name !== undefined ? body.name : existingAddr.name,
      phone: body.phone !== undefined ? body.phone : existingAddr.phone,
      address: body.address !== undefined ? body.address : existingAddr.address,
      city: body.city !== undefined ? body.city : existingAddr.city,
      district: body.district !== undefined ? body.district : existingAddr.district,
      postalCode: body.postalCode !== undefined ? body.postalCode : existingAddr.postalCode,
      isDefault: isDefault !== undefined ? isDefault : false,
    }

    const parsed = validateAddressParts(toValidate)
    if (!parsed.ok) {
      return NextResponse.json(validationError(parsed.errors), { status: 400 })
    }

    const targetUserId = userId || existingAddr.userId
    // If setting as default, unset others
    if (isDefault && targetUserId) {
      await db.address.updateMany({
        where: { userId: targetUserId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const data: Record<string, unknown> = {
      name: parsed.data.name,
      phone: parsed.data.phone,
      address: parsed.data.address,
      city: parsed.data.city,
      district: parsed.data.district,
      postalCode: parsed.data.postalCode,
    }
    if (isDefault !== undefined) data.isDefault = Boolean(isDefault)

    const addr = await db.address.update({ where: { id }, data })

    return NextResponse.json({ success: true, data: addr })
  } catch (error) {
    console.error('Update address error:', error)
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
    const authUser = await getUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Ownership check: non-admin users can only delete their own addresses
    if (authUser.role !== 'admin' && authUser.role !== 'manager') {
      const existingAddr = await db.address.findUnique({ where: { id }, select: { userId: true } })
      if (!existingAddr || existingAddr.userId !== authUser.userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: you can only delete your own addresses' },
          { status: 403 }
        )
      }
    }

    await db.address.delete({ where: { id } })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete address error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
