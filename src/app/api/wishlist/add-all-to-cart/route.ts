import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    // Get all wishlist items for the user
    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId

    const wishlistItems = await db.wishlist.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            stock: true,
            status: true,
            price: true,
            discountPrice: true,
            unit: true,
          },
        },
      },
    })

    if (wishlistItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Wishlist is empty' },
        { status: 400 }
      )
    }

    let addedCount = 0
    let skippedCount = 0
    const addedItems: string[] = []
    const skippedItems: { productId: string; name: string; reason: string }[] = []

    for (const wishItem of wishlistItems) {
      const product = wishItem.product

      // Skip out of stock or inactive products
      if (!product || product.stock <= 0 || product.status !== 'active') {
        skippedCount++
        skippedItems.push({
          productId: wishItem.productId,
          name: product?.name || 'Unknown Product',
          reason: !product ? 'Product not found' : product.stock <= 0 ? 'Out of stock' : 'Product unavailable',
        })
        continue
      }

      // Check if already in cart
      const cartWhere: Record<string, unknown> = { productId: product.id }
      if (userId) cartWhere.userId = userId
      else if (sessionId) cartWhere.sessionId = sessionId

      const existingCart = await db.cartItem.findFirst({ where: cartWhere })

      if (existingCart) {
        // Increment quantity
        await db.cartItem.update({
          where: { id: existingCart.id },
          data: { quantity: existingCart.quantity + 1 },
        })
      } else {
        // Create new cart item
        await db.cartItem.create({
          data: {
            userId: userId || null,
            sessionId: sessionId || null,
            productId: product.id,
            quantity: 1,
            unit: product.unit || 'kg',
          },
        })
      }

      addedCount++
      addedItems.push(product.id)
    }

    // Remove added items from wishlist
    if (addedItems.length > 0) {
      await db.wishlist.deleteMany({
        where: {
          ...(userId ? { userId } : {}),
          productId: { in: addedItems },
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        addedCount,
        skippedCount,
        addedItems,
        skippedItems,
      },
    })
  } catch (error) {
    console.error('Add all to cart error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
