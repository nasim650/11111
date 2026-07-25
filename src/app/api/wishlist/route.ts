import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/utils'

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

    const wishlist = await db.wishlist.findMany({
      where: { userId },
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
            isFeatured: true,
            isBestSeller: true,
            isNewArrival: true,
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Enhance with stock status and effective price
    const enhancedWishlist = wishlist.map((item) => ({
      ...item,
      product: {
        ...item.product,
        effectivePrice: item.product.discountPrice ?? item.product.price,
        stockStatus: item.product.stock <= 0 ? 'out_of_stock'
          : item.product.stock <= 5 ? 'low_stock'
          : 'in_stock',
      },
    }))

    return NextResponse.json({ success: true, data: enhancedWishlist })
  } catch (error) {
    console.error('Get wishlist error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, productId } = body

    if (!userId || !productId) {
      return NextResponse.json(
        { success: false, error: 'userId and productId are required' },
        { status: 400 }
      )
    }

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
        { success: false, error: 'Unauthorized: you can only manage your own wishlist' },
        { status: 403 }
      )
    }

    // Validate product exists
    const product = await db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        discountPrice: true,
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

    const existing = await db.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Product already in wishlist' },
        { status: 409 }
      )
    }

    const item = await db.wishlist.create({
      data: { userId, productId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            discountPrice: true,
            stock: true,
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error) {
    console.error('Add to wishlist error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const productId = url.searchParams.get('productId')
    const id = url.searchParams.get('id') // Support removing by wishlist record id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

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
        { success: false, error: 'Unauthorized: you can only manage your own wishlist' },
        { status: 403 }
      )
    }

    if (id) {
      // Remove by wishlist record id
      await db.wishlist.delete({
        where: { id },
      })
    } else if (productId) {
      // Remove by productId
      await db.wishlist.deleteMany({
        where: { userId, productId },
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'productId or id is required' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Remove from wishlist error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
