import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const requestUserId = await getUserIdFromRequest(request)

    // Users can only manage their own addresses
    if (requestUserId && requestUserId !== id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, addressId, address, isDefault } = body

    // Verify user exists
    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    switch (action) {
      case 'add': {
        if (!address || !address.name || !address.phone || !address.address || !address.city) {
          return NextResponse.json(
            { success: false, error: 'name, phone, address, and city are required' },
            { status: 400 }
          )
        }

        // If this is the first address or isDefault is true, unset other defaults
        if (isDefault) {
          await db.address.updateMany({
            where: { userId: id, isDefault: true },
            data: { isDefault: false },
          })
        }

        const existingCount = await db.address.count({ where: { userId: id } })
        const newAddress = await db.address.create({
          data: {
            userId: id,
            name: address.name,
            phone: address.phone,
            address: address.address,
            city: address.city,
            district: address.district || null,
            postalCode: address.postalCode || null,
            isDefault: isDefault || existingCount === 0,
          },
        })

        return NextResponse.json({ success: true, data: newAddress }, { status: 201 })
      }

      case 'update': {
        if (!addressId) {
          return NextResponse.json(
            { success: false, error: 'addressId is required for update' },
            { status: 400 }
          )
        }

        // Verify address belongs to this user
        const existingAddress = await db.address.findFirst({
          where: { id: addressId, userId: id },
        })
        if (!existingAddress) {
          return NextResponse.json(
            { success: false, error: 'Address not found' },
            { status: 404 }
          )
        }

        // If setting as default, unset other defaults
        if (isDefault || address?.isDefault) {
          await db.address.updateMany({
            where: { userId: id, isDefault: true },
            data: { isDefault: false },
          })
        }

        const updateData: Record<string, unknown> = {}
        if (address?.name !== undefined) updateData.name = address.name
        if (address?.phone !== undefined) updateData.phone = address.phone
        if (address?.address !== undefined) updateData.address = address.address
        if (address?.city !== undefined) updateData.city = address.city
        if (address?.district !== undefined) updateData.district = address.district
        if (address?.postalCode !== undefined) updateData.postalCode = address.postalCode
        if (isDefault !== undefined) updateData.isDefault = isDefault
        if (address?.isDefault !== undefined) updateData.isDefault = address.isDefault

        const updatedAddress = await db.address.update({
          where: { id: addressId },
          data: updateData,
        })

        return NextResponse.json({ success: true, data: updatedAddress })
      }

      case 'delete': {
        if (!addressId) {
          return NextResponse.json(
            { success: false, error: 'addressId is required for delete' },
            { status: 400 }
          )
        }

        // Verify address belongs to this user
        const addrToDelete = await db.address.findFirst({
          where: { id: addressId, userId: id },
        })
        if (!addrToDelete) {
          return NextResponse.json(
            { success: false, error: 'Address not found' },
            { status: 404 }
          )
        }

        await db.address.delete({ where: { id: addressId } })

        // If deleted address was default, set another as default
        if (addrToDelete.isDefault) {
          const firstAddress = await db.address.findFirst({
            where: { userId: id },
            orderBy: { createdAt: 'asc' },
          })
          if (firstAddress) {
            await db.address.update({
              where: { id: firstAddress.id },
              data: { isDefault: true },
            })
          }
        }

        return NextResponse.json({ success: true, data: null })
      }

      case 'setDefault': {
        if (!addressId) {
          return NextResponse.json(
            { success: false, error: 'addressId is required for setDefault' },
            { status: 400 }
          )
        }

        // Verify address belongs to this user
        const defaultAddr = await db.address.findFirst({
          where: { id: addressId, userId: id },
        })
        if (!defaultAddr) {
          return NextResponse.json(
            { success: false, error: 'Address not found' },
            { status: 404 }
          )
        }

        // Unset all defaults, then set the specified one
        await db.address.updateMany({
          where: { userId: id, isDefault: true },
          data: { isDefault: false },
        })
        await db.address.update({
          where: { id: addressId },
          data: { isDefault: true },
        })

        return NextResponse.json({ success: true, data: { addressId, isDefault: true } })
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: add, update, delete, or setDefault' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Address management error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const requestUserId = await getUserIdFromRequest(request)

    // Users can only view their own addresses
    if (requestUserId && requestUserId !== id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const addresses = await db.address.findMany({
      where: { userId: id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ success: true, data: addresses })
  } catch (error) {
    console.error('Get addresses error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
