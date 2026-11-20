import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/utils'
import { getShippingSettings } from '@/lib/shipping'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const sessionId = url.searchParams.get('sessionId')

    if (!userId && !sessionId) {
      return NextResponse.json(
        { success: false, error: 'userId or sessionId is required' },
        { status: 400 }
      )
    }

    // Ownership check: authenticated users can only see their own cart
    if (userId) {
      const authUser = await getUserFromRequest(request)
      if (!authUser) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        )
      }
      if (authUser.role !== 'admin' && authUser.role !== 'manager' && authUser.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: can only access your own cart' },
          { status: 403 }
        )
      }
    }

    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId
    if (sessionId) where.sessionId = sessionId

    const cartItems = await db.cartItem.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            discountPrice: true,
            unit: true,
            stock: true,
            status: true,
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate cart totals
    let subtotal = 0
    for (const item of cartItems) {
      const price = item.product.discountPrice ?? item.product.price
      subtotal += price * item.quantity
    }

    // Get shipping configuration from canonical source
    const shippingSettings = await getShippingSettings()
    const freeShippingThreshold = shippingSettings.freeShippingThreshold
    const shippingCharge = shippingSettings.standardDeliveryCharge

    const shipping = subtotal >= freeShippingThreshold ? 0 : shippingCharge
    const discount = 0 // Discount applied via coupon endpoint
    const total = subtotal + shipping - discount

    const totals = {
      subtotal: Math.round(subtotal * 100) / 100,
      shipping: Math.round(shipping * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
      freeShippingThreshold,
      remainingForFreeShipping: Math.max(0, Math.round((freeShippingThreshold - subtotal) * 100) / 100),
    }

    return NextResponse.json({
      success: true,
      data: {
        items: cartItems,
        totals,
      },
    })
  } catch (error) {
    console.error('Get cart error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, sessionId, productId, quantity, unit } = body

    if (!productId || (!userId && !sessionId)) {
      return NextResponse.json(
        { success: false, error: 'productId and userId/sessionId are required' },
        { status: 400 }
      )
    }

    // Ownership check: authenticated users can only add to their own cart
    if (userId) {
      const authUser = await getUserFromRequest(request)
      if (!authUser) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        )
      }
      if (authUser.role !== 'admin' && authUser.role !== 'manager' && authUser.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: can only add items to your own cart' },
          { status: 403 }
        )
      }
    }

    // Validate product exists and is in stock
    const product = await db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        discountPrice: true,
        unit: true,
        stock: true,
        status: true,
        images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    if (product.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Product is not available' },
        { status: 400 }
      )
    }

    if (product.stock <= 0) {
      return NextResponse.json(
        { success: false, error: 'Product is out of stock' },
        { status: 400 }
      )
    }

    // Check if item already exists in cart
    const existing = await db.cartItem.findFirst({
      where: {
        productId,
        ...(userId ? { userId } : { sessionId }),
      },
    })

    if (existing) {
      const newQuantity = existing.quantity + (quantity || 1)

      // Validate stock for new quantity
      if (newQuantity > product.stock) {
        return NextResponse.json(
          { success: false, error: `Only ${product.stock} items available in stock` },
          { status: 400 }
        )
      }

      const updated = await db.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQuantity },
        include: { product: { select: { id: true, name: true, price: true, discountPrice: true, stock: true, images: { orderBy: { sortOrder: 'asc' }, take: 1 } } } },
      })
      return NextResponse.json({ success: true, data: updated })
    }

    // Validate requested quantity against stock
    const requestedQty = quantity || 1
    if (requestedQty > product.stock) {
      return NextResponse.json(
        { success: false, error: `Only ${product.stock} items available in stock` },
        { status: 400 }
      )
    }

    const cartItem = await db.cartItem.create({
      data: {
        userId: userId || null,
        sessionId: sessionId || null,
        productId,
        quantity: requestedQty,
        unit: unit || product.unit || 'kg',
      },
      include: { product: { select: { id: true, name: true, price: true, discountPrice: true, stock: true, images: { orderBy: { sortOrder: 'asc' }, take: 1 } } } },
    })

    return NextResponse.json({ success: true, data: cartItem }, { status: 201 })
  } catch (error) {
    console.error('Add to cart error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
