import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const q = url.searchParams.get('q') || ''
    const limit = Math.min(10, Math.max(1, parseInt(url.searchParams.get('limit') || '5')))

    if (!q || q.length < 2) {
      return NextResponse.json({
        success: true,
        data: { products: [], categories: [] },
      })
    }

    // Search products for suggestions (lightweight response)
    const products = await db.product.findMany({
      where: {
        status: 'active',
        OR: [
          { name: { contains: q } },
          { tags: { contains: q } },
          { shortDescription: { contains: q } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        discountPrice: true,
        images: { where: { isFeatured: true }, take: 1, select: { url: true } },
        category: { select: { name: true, slug: true } },
      },
      take: limit,
    })

    // Search categories for suggestions
    const categories = await db.category.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q } },
          { slug: { contains: q } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        icon: true,
      },
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: {
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          discountPrice: p.discountPrice,
          effectivePrice: p.discountPrice ?? p.price,
          image: p.images[0]?.url || null,
          category: p.category,
        })),
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          image: c.image,
          icon: c.icon,
        })),
      },
    })
  } catch (error) {
    console.error('Product suggestions error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
