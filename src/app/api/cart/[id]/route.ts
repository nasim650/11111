import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { quantity, unit } = body

    if (quantity !== undefined && quantity < 1) {
      return NextResponse.json(
        { success: false, error: 'Quantity must be at least 1' },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {}
    if (quantity !== undefined) data.quantity = quantity
    if (unit !== undefined) data.unit = unit

    const cartItem = await db.cartItem.update({
      where: { id },
      data,
      include: { product: { select: { id: true, name: true, price: true, discountPrice: true } } },
    })

    return NextResponse.json({ success: true, data: cartItem })
  } catch (error) {
    console.error('Update cart item error:', error)
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
    const { id } = await params
    await db.cartItem.delete({ where: { id } })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete cart item error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
