import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/utils'
import { validateAddressParts, validationError } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const authUser = await getUserFromRequest(request)
    const userId = authUser?.userId || new URL(request.url).searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Ownership check: non-admin users can only see their own addresses
    if (authUser && authUser.role !== 'admin' && authUser.role !== 'manager') {
      const queryUserId = new URL(request.url).searchParams.get('userId')
      if (queryUserId && queryUserId !== authUser.userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: you can only view your own addresses' },
          { status: 403 }
        )
      }
    }

    const addresses = await db.address.findMany({
      where: { userId },
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, isDefault } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    const parsedAddress = validateAddressParts(body)
    if (!parsedAddress.ok) {
      return NextResponse.json(validationError(parsedAddress.errors), { status: 400 })
    }
    const { name, phone, address, city, district, postalCode } = parsedAddress.data

    // Ownership check: verify userId matches authenticated user
    const authUser = await getUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    if (authUser.role !== 'admin' && authUser.role !== 'manager' && authUser.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: you can only create addresses for yourself' },
        { status: 403 }
      )
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await db.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const addr = await db.address.create({
      data: {
        userId,
        name,
        phone,
        address,
        city,
        district: district || null,
        postalCode: postalCode || null,
        isDefault: isDefault ?? false,
      },
    })

    return NextResponse.json({ success: true, data: addr }, { status: 201 })
  } catch (error) {
    console.error('Create address error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
