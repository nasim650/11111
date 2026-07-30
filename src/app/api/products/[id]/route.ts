import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin, slugify } from '@/lib/utils'
import { deleteManagedMedia } from '@/lib/media'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const compareIds = url.searchParams.get('compareIds')

    const product = await db.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true, image: true, icon: true } },
        subcategory: { select: { id: true, name: true, slug: true, image: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        videos: { orderBy: { sortOrder: 'asc' } },
        reviews: {
          where: { isApproved: true, isActive: true },
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Calculate review statistics
    const totalReviews = product.reviews.length
    const avgRating = totalReviews > 0
      ? Math.round((product.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / totalReviews) * 10) / 10
      : 0

    // Rating breakdown (1-5 stars)
    const ratingBreakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const review of product.reviews) {
      if (review.rating >= 1 && review.rating <= 5) {
        ratingBreakdown[review.rating]++
      }
    }

    const reviewStats = {
      averageRating: avgRating,
      totalCount: totalReviews,
      ratingBreakdown,
    }

    // Check if product is in user's wishlist
    let isInWishlist = false
    if (userId) {
      const wishlistItem = await db.wishlist.findUnique({
        where: { userId_productId: { userId, productId: id } },
      })
      isInWishlist = !!wishlistItem
    }

    // Check if product is in compare list
    let isInCompare = false
    if (compareIds) {
      const ids = compareIds.split(',').filter(Boolean)
      isInCompare = ids.includes(id)
    }

    // Get related products from the same category (limit 4)
    const relatedProducts = await db.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: id },
        status: 'active',
      },
      include: {
        images: { where: { isFeatured: true }, take: 1 },
        category: { select: { id: true, name: true, slug: true } },
      },
      take: 4,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        avgRating,
        reviewStats,
        isInWishlist,
        isInCompare,
        relatedProducts: relatedProducts.map((p) => ({
          ...p,
          image: p.images[0]?.url || null,
          effectivePrice: p.discountPrice ?? p.price,
        })),
      },
    })
  } catch (error) {
    console.error('Get product error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    const data: Record<string, unknown> = {}
    const fields = [
      'name', 'shortDescription', 'description', 'unit', 'origin',
      'qualityNote', 'ingredients', 'storageInstruction', 'deliveryNote',
      'metaTitle', 'metaDescription', 'metaKeywords', 'subcategoryId',
      'status', 'tags', 'specifications',
    ]
    for (const field of fields) {
      if (body[field] === undefined) continue
      if (field === 'tags') {
        data[field] = Array.isArray(body[field]) ? body[field].join(',') : body[field]
      } else if (field === 'specifications' && body[field] && typeof body[field] !== 'string') {
        data[field] = JSON.stringify(body[field])
      } else {
        data[field] = body[field]
      }
    }
    if (body.name !== undefined) data.slug = body.slug || slugify(body.name)
    if (body.price !== undefined) data.price = parseFloat(String(body.price))
    if (body.discountPrice !== undefined) data.discountPrice = body.discountPrice ? parseFloat(String(body.discountPrice)) : null
    if (body.stock !== undefined) data.stock = parseInt(String(body.stock))
    if (body.categoryId !== undefined) data.categoryId = body.categoryId
    if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured
    if (body.isBestSeller !== undefined) data.isBestSeller = body.isBestSeller
    if (body.isNewArrival !== undefined) data.isNewArrival = body.isNewArrival
    if (body.isFlashSale !== undefined) data.isFlashSale = body.isFlashSale

    const existingImages = body.images !== undefined
      ? await db.productImage.findMany({ where: { productId: id }, select: { url: true } })
      : []

    const product = await db.$transaction(async (tx) => {
      if (body.images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId: id } })
      }

      return tx.product.update({
        where: { id },
        data: {
          ...data,
          ...(body.images !== undefined
            ? {
                images: {
                  create: body.images.map(
                    (
                      image: { url: string; alt?: string; sortOrder?: number; isFeatured?: boolean },
                      index: number
                    ) => ({
                      url: image.url,
                      alt: image.alt || null,
                      sortOrder: image.sortOrder ?? index,
                      isFeatured: image.isFeatured ?? index === 0,
                    })
                  ),
                },
              }
            : {}),
        },
        include: { images: true, category: true },
      })
    })

    const retainedUrls = new Set(product.images.map((image) => image.url))
    await deleteManagedMedia(existingImages.map((image) => image.url).filter((url) => !retainedUrls.has(url)))

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Update product error:', error)
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
    const product = await db.product.findUnique({
      where: { id },
      select: {
        images: { select: { url: true } },
        videos: { select: { url: true, thumbnail: true } },
      },
    })
    await db.product.delete({ where: { id } })
    await deleteManagedMedia([
      ...(product?.images.map((image) => image.url) ?? []),
      ...(product?.videos.flatMap((video) => [video.url, video.thumbnail]) ?? []),
    ])

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete product error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
