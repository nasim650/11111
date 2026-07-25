import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, getUserIdFromRequest, isAdmin, slugify, getPaginationParams, paginatedResponse } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const { page, limit, skip } = getPaginationParams(url)

    const categoryId = url.searchParams.get('categoryId') || url.searchParams.get('category')
    const subcategoryId = url.searchParams.get('subcategoryId')
    const search = url.searchParams.get('search')
    const minPrice = url.searchParams.get('minPrice')
    const maxPrice = url.searchParams.get('maxPrice')
    const sort = url.searchParams.get('sort') || 'createdAt'
    const order = url.searchParams.get('order') || 'desc'
    const status = url.searchParams.get('status')
    const isFeatured = url.searchParams.get('isFeatured')
    const isBestSeller = url.searchParams.get('isBestSeller')
    const isNewArrival = url.searchParams.get('isNewArrival')
    const inStock = url.searchParams.get('inStock')
    const tags = url.searchParams.get('tags')
    const categories = url.searchParams.get('categories') // comma-separated category IDs/slugs
    const includeFacets = url.searchParams.get('includeFacets') === 'true'
    // New filter params
    const minRating = url.searchParams.get('minRating')
    const origin = url.searchParams.get('origin')
    const minDiscount = url.searchParams.get('minDiscount')

    const where: Record<string, unknown> = {}

    // Filter by status (default to active for public queries)
    if (status) {
      where.status = status
    } else {
      const role = await getUserRoleFromRequest(request)
      if (!isAdmin(role)) {
        where.status = 'active'
      }
    }

    // Filter by single category
    if (categoryId) {
      if (!categoryId.startsWith('c') || categoryId.length < 20) {
        const cat = await db.category.findFirst({ where: { slug: categoryId }, select: { id: true } })
        if (cat) {
          where.categoryId = cat.id
        } else {
          where.categoryId = categoryId
        }
      } else {
        where.categoryId = categoryId
      }
    }

    // Filter by multiple categories (comma-separated)
    if (categories) {
      const categoryList = categories.split(',').filter(Boolean)
      if (categoryList.length > 0) {
        // Resolve slugs to IDs
        const categoryIds: string[] = []
        for (const catRef of categoryList) {
          if (catRef.startsWith('c') && catRef.length >= 20) {
            categoryIds.push(catRef)
          } else {
            const cat = await db.category.findFirst({ where: { slug: catRef }, select: { id: true } })
            if (cat) categoryIds.push(cat.id)
          }
        }
        if (categoryIds.length > 0) {
          where.categoryId = { in: categoryIds }
        }
      }
    }

    if (subcategoryId) {
      // Resolve subcategory slug to ID if needed
      if (!subcategoryId.startsWith('c') || subcategoryId.length < 20) {
        const subcat = await db.subcategory.findFirst({ where: { slug: subcategoryId }, select: { id: true } })
        if (subcat) {
          where.subcategoryId = subcat.id
        } else {
          where.subcategoryId = subcategoryId
        }
      } else {
        where.subcategoryId = subcategoryId
      }
    }
    if (isFeatured === 'true') where.isFeatured = true
    if (isBestSeller === 'true') where.isBestSeller = true
    if (isNewArrival === 'true') where.isNewArrival = true
    if (inStock === 'true') where.stock = { gt: 0 }

    // Origin filter - use contains for partial match (e.g., "Bangladesh" matches "Rangamati, Bangladesh")
    const originList = origin ? origin.split(',').filter(Boolean) : []
    const needsOriginPostFetch = originList.length > 1 // Multiple origins need post-fetch filtering
    if (originList.length === 1) {
      where.origin = { contains: originList[0] }
    }

    // Full-text search across name, description, and tags
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { shortDescription: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
        { origin: { contains: search } },
      ]
    }

    if (tags) where.tags = { contains: tags }

    // Price range filter - use effective price (discountPrice or price)
    if (minPrice || maxPrice) {
      const priceFilter: Record<string, number> = {}
      if (minPrice) priceFilter.gte = parseFloat(minPrice)
      if (maxPrice) priceFilter.lte = parseFloat(maxPrice)
      where.price = priceFilter
    }

    // Min discount filter - only include products that have a discount >= minDiscount%
    if (minDiscount) {
      const discountVal = parseFloat(minDiscount)
      if (discountVal > 0) {
        where.discountPrice = { not: null }
        // We need post-fetch filtering for cross-field comparison, but we can at least
        // narrow down to products that have a discount price
      }
    }

    // Check if we need post-fetch processing for rating sort/filter/discount/multi-origin
    const needsPostFetch = (minRating && parseFloat(minRating) > 0) || sort === 'rating' || sort === 'relevance' || (minDiscount && parseFloat(minDiscount) > 0) || needsOriginPostFetch

    // Map sort values to valid Prisma fields
    const sortMap: Record<string, string> = {
      latest: 'createdAt',
      newest: 'createdAt',
      price_asc: 'price',
      price_desc: 'price',
      price_low: 'price',
      price_high: 'price',
      best_selling: 'createdAt',
      popularity: 'createdAt',
      discount: 'discountPrice',
      name: 'name',
      createdAt: 'createdAt',
      price: 'price',
      // rating and relevance need post-fetch sort
      rating: 'createdAt',
      relevance: 'createdAt',
    }
    const sortField = sortMap[sort] || 'createdAt'
    const sortDirection = (sort === 'price_asc' || sort === 'price_low') ? 'asc'
      : (sort === 'price_desc' || sort === 'price_high') ? 'desc'
      : order

    const orderBy: Record<string, string> = {}
    orderBy[sortField] = sortDirection

    let products: Array<Record<string, unknown>>
    let total: number

    if (needsPostFetch) {
      // Fetch all matching products for post-fetch filtering/sorting
      const allProducts = await db.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          subcategory: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: 'asc' } },
          reviews: {
            where: { isApproved: true, isActive: true },
            select: { rating: true },
          },
          _count: { select: { orderItems: true } },
        },
        orderBy,
      })

      // Compute enhanced products with ratings and discounts
      let enhancedProducts = allProducts.map((product) => {
        const avgRating = product.reviews.length > 0
          ? Math.round((product.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / product.reviews.length) * 10) / 10
          : 0
        const discountPercentage = product.discountPrice
          ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
          : 0

        const { reviews, _count, ...rest } = product
        return {
          ...rest,
          avgRating,
          reviewCount: product.reviews.length,
          orderCount: product._count.orderItems,
          discountPercentage,
          effectivePrice: product.discountPrice ?? product.price,
          stockStatus: product.stock <= 0 ? 'out_of_stock' : product.stock <= 5 ? 'low_stock' : 'in_stock',
        }
      })

      // Apply minRating filter
      if (minRating) {
        const ratingVal = parseFloat(minRating)
        enhancedProducts = enhancedProducts.filter((p) => (p.avgRating as number) >= ratingVal)
      }

      // Apply minDiscount filter
      if (minDiscount) {
        const discountVal = parseFloat(minDiscount)
        if (discountVal > 0) {
          enhancedProducts = enhancedProducts.filter((p) => (p.discountPercentage as number) >= discountVal)
        }
      }

      // Apply multi-origin post-fetch filter
      if (needsOriginPostFetch && originList.length > 1) {
        enhancedProducts = enhancedProducts.filter((p) => {
          const productOrigin = (p.origin as string) || ''
          return originList.some((o) => productOrigin.toLowerCase().includes(o.toLowerCase()))
        })
      }

      // Apply post-fetch sorting
      if (sort === 'rating') {
        enhancedProducts.sort((a, b) => (b.avgRating as number) - (a.avgRating as number))
      } else if (sort === 'relevance') {
        if (search) {
          // Score by relevance: exact name match > name contains > description contains
          enhancedProducts.sort((a, b) => {
            const scoreA = getRelevanceScore(a.name as string, a.shortDescription as string | null, search)
            const scoreB = getRelevanceScore(b.name as string, b.shortDescription as string | null, search)
            return scoreB - scoreA
          })
        } else {
          // No search query, sort by best selling (order count)
          enhancedProducts.sort((a, b) => (b.orderCount as number) - (a.orderCount as number))
        }
      }

      total = enhancedProducts.length
      products = enhancedProducts.slice(skip, skip + limit)
    } else {
      // Standard query with Prisma pagination
      const [prods, count] = await Promise.all([
        db.product.findMany({
          where,
          include: {
            category: { select: { id: true, name: true, slug: true } },
            subcategory: { select: { id: true, name: true, slug: true } },
            images: { orderBy: { sortOrder: 'asc' } },
            reviews: {
              where: { isApproved: true, isActive: true },
              select: { rating: true },
            },
            _count: { select: { orderItems: true } },
          },
          orderBy,
          skip,
          take: limit,
        }),
        db.product.count({ where }),
      ])

      total = count
      products = prods.map((product) => {
        const avgRating = product.reviews.length > 0
          ? Math.round((product.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / product.reviews.length) * 10) / 10
          : 0
        const discountPercentage = product.discountPrice
          ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
          : 0

        const { reviews, _count, ...rest } = product
        return {
          ...rest,
          avgRating,
          reviewCount: product.reviews.length,
          orderCount: product._count.orderItems,
          discountPercentage,
          effectivePrice: product.discountPrice ?? product.price,
          stockStatus: product.stock <= 0 ? 'out_of_stock' : product.stock <= 5 ? 'low_stock' : 'in_stock',
        }
      })
    }

    // Build facets if requested
    let facets: {
      categories: Array<{ id?: string; name?: string; slug?: string; count: number }>
      priceRange: { min: number; max: number }
      origins: Array<{ name: string | null; count: number }>
    } | null = null
    if (includeFacets) {
      const [categoryFacets, priceRange, brandFacets] = await Promise.all([
        // Available categories for current results
        db.product.groupBy({
          by: ['categoryId'],
          where,
          _count: { categoryId: true },
        }),
        // Price range
        db.product.aggregate({
          where,
          _min: { price: true },
          _max: { price: true },
        }),
        // Origins/brands for current results
        db.product.groupBy({
          by: ['origin'],
          where: { ...where, origin: { not: null } },
          _count: { origin: true },
        }),
      ])

      // Resolve category names
      const categoryIds = categoryFacets.map((cf) => cf.categoryId).filter(Boolean)
      const categoryDetails = await db.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, slug: true },
      })

      facets = {
        categories: categoryFacets.map((cf) => ({
          ...categoryDetails.find((c) => c.id === cf.categoryId),
          count: cf._count.categoryId,
        })).filter((f) => f.id),
        priceRange: {
          min: priceRange._min.price ?? 0,
          max: priceRange._max.price ?? 0,
        },
        origins: brandFacets
          .filter((b) => b.origin)
          .map((b) => ({
            name: b.origin,
            count: b._count.origin,
          })),
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...paginatedResponse(products, total, page, limit),
        ...(facets ? { facets } : {}),
      },
    })
  } catch (error) {
    console.error('Get products error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Relevance scoring helper
function getRelevanceScore(name: string, shortDescription: string | null, search: string): number {
  const lowerName = name.toLowerCase()
  const lowerSearch = search.toLowerCase()
  let score = 0

  // Exact name match
  if (lowerName === lowerSearch) score += 100
  // Name starts with search
  else if (lowerName.startsWith(lowerSearch)) score += 80
  // Name contains search
  else if (lowerName.includes(lowerSearch)) score += 60
  // Word match in name
  else {
    const searchWords = lowerSearch.split(/\s+/)
    for (const word of searchWords) {
      if (lowerName.includes(word)) score += 30
    }
  }

  // Description contains search
  if (shortDescription && shortDescription.toLowerCase().includes(lowerSearch)) score += 10

  return score
}

export async function POST(request: NextRequest) {
  try {
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name, slug, shortDescription, description, price, discountPrice, unit,
      stock, origin, qualityNote, ingredients, storageInstruction, deliveryNote,
      metaTitle, metaDescription, metaKeywords, categoryId, subcategoryId,
      status, isFeatured, isBestSeller, isNewArrival, tags, specifications,
      images,
    } = body

    if (!name || !price || !categoryId) {
      return NextResponse.json(
        { success: false, error: 'Name, price, and categoryId are required' },
        { status: 400 }
      )
    }

    const product = await db.product.create({
      data: {
        name,
        slug: slug || slugify(name),
        shortDescription: shortDescription || null,
        description: description || null,
        price: parseFloat(String(price)),
        discountPrice: discountPrice ? parseFloat(String(discountPrice)) : null,
        unit: unit || 'kg',
        stock: stock ?? 0,
        origin: origin || null,
        qualityNote: qualityNote || null,
        ingredients: ingredients || null,
        storageInstruction: storageInstruction || null,
        deliveryNote: deliveryNote || null,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        metaKeywords: metaKeywords || null,
        categoryId,
        subcategoryId: subcategoryId || null,
        status: status || 'active',
        isFeatured: isFeatured ?? false,
        isBestSeller: isBestSeller ?? false,
        isNewArrival: isNewArrival ?? false,
        tags: Array.isArray(tags) ? tags.join(',') : tags || null,
        specifications:
          specifications && typeof specifications !== 'string'
            ? JSON.stringify(specifications)
            : specifications || null,
        images: images
          ? {
              create: images.map((img: { url: string; alt?: string; sortOrder?: number; isFeatured?: boolean }, index: number) => ({
                url: img.url,
                alt: img.alt || null,
                sortOrder: img.sortOrder ?? index,
                isFeatured: img.isFeatured ?? index === 0,
              })),
            }
          : undefined,
      },
      include: { images: true, category: true },
    })

    // Audit log
    const adminId = await getUserIdFromRequest(request)
    await createAuditLog({
      adminId: adminId ?? undefined,
      action: 'create',
      module: 'products',
      referenceId: product.id,
      newData: product,
    })

    return NextResponse.json({ success: true, data: product }, { status: 201 })
  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
