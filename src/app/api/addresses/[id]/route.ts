import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/utils'

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
    const { name, phone, address, city, district, postalCode, isDefault, userId } = body

    // Ownership check: non-admin users can only update their own addresses
    if (authUser.role !== 'admin' && authUser.role !== 'manager') {
      const existingAddr = await db.address.findUnique({ where: { id }, select: { userId: true } })
      if (!existingAddr || existingAddr.userId !== authUser.userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: you can only update your own addresses' },
          { status: 403 }
        )
      }
    }

    // If setting as default, unset others
    if (isDefault && userId) {
      await db.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (phone !== undefined) data.phone = phone
    if (address !== undefined) data.address = address
    if (city !== undefined) data.city = city
    if (district !== undefined) data.district = district
    if (postalCode !== undefined) data.postalCode = postalCode
    if (isDefault !== undefined) data.isDefault = isDefault

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
