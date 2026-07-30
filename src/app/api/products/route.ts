import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, getUserIdFromRequest, isAdmin, slugify, getPaginationParams, paginatedResponse } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { getCachedData, invalidateCache } from '@/lib/cache'

// Helper for GET logic so we can wrap it
async function fetchProductsData(url: URL, request: NextRequest) {
  const { page, limit, skip } = getPaginationParams(url)

  const categoryId = url.searchParams.get('categoryId') || url.searchParams.get('category')
  const subcategoryId = url.searchParams.get('subcategoryId')
  const search = url.searchParams.get('search')
  const minPrice = url.searchParams.get('minPrice')
  const maxPrice = url.searchParams.get('maxPrice')
  const sortRaw = url.searchParams.get('sort') || 'createdAt'
  const orderRaw = url.searchParams.get('order') || 'desc'
  
  let prismaOrderBy: Record<string, string> = { createdAt: 'desc' }
  if (sortRaw === 'price_asc') prismaOrderBy = { price: 'asc' }
  else if (sortRaw === 'price_desc') prismaOrderBy = { price: 'desc' }
  else if (sortRaw === 'newest') prismaOrderBy = { createdAt: 'desc' }
  else if (sortRaw === 'best_selling') prismaOrderBy = { isBestSeller: 'desc' }
  else if (sortRaw === 'createdAt') prismaOrderBy = { createdAt: orderRaw }
  else if (sortRaw === 'price') prismaOrderBy = { price: orderRaw }
  else if (sortRaw === 'rating' || sortRaw === 'relevance') {
    prismaOrderBy = { createdAt: 'desc' }
  }
  const status = url.searchParams.get('status')
  const isFeatured = url.searchParams.get('isFeatured')
  const isBestSeller = url.searchParams.get('isBestSeller')
  const isNewArrival = url.searchParams.get('isNewArrival')
  const inStock = url.searchParams.get('inStock')
  const tags = url.searchParams.get('tags')
  const categories = url.searchParams.get('categories')
  const includeFacets = url.searchParams.get('includeFacets') === 'true'
  const minRating = url.searchParams.get('minRating')
  const origin = url.searchParams.get('origin')
  const minDiscount = url.searchParams.get('minDiscount')

  const where: Record<string, unknown> = {}

  if (status) {
    where.status = status
  } else {
    try {
      const role = await getUserRoleFromRequest(request)
      if (!isAdmin(role)) {
        where.status = 'active'
      }
    } catch(e) {
      where.status = 'active'
    }
  }

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

  if (categories) {
    const categoryList = categories.split(',').filter(Boolean)
    if (categoryList.length > 0) {
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

  const originList = origin ? origin.split(',').filter(Boolean) : []
  const needsOriginPostFetch = originList.length > 1
  if (originList.length === 1) {
    where.origin = { contains: originList[0] }
  }

  if (minPrice !== null && maxPrice !== null) {
    where.price = { gte: parseFloat(minPrice), lte: parseFloat(maxPrice) }
  } else if (minPrice !== null) {
    where.price = { gte: parseFloat(minPrice) }
  } else if (maxPrice !== null) {
    where.price = { lte: parseFloat(maxPrice) }
  }
  
  if (minDiscount !== null) {
    where.discountPrice = { not: null }
  }
  if (tags) {
    where.tags = { contains: tags }
  }

  let products: any[] = []
  let total = 0

  const needsJSSort = sortRaw === 'rating' || (sortRaw === 'relevance' && search);
  if (needsOriginPostFetch || minRating !== null || (minDiscount !== null && parseFloat(minDiscount) > 0) || search || needsJSSort) {
    const allProducts = await db.product.findMany({
      where,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        category: true,
        subcategory: true,
        reviews: { where: { isApproved: true }, select: { rating: true } },
      },
      orderBy: prismaOrderBy,
    })

    let filtered = allProducts

    if (search) {
      filtered = filtered.filter(p => getRelevanceScore(p.name, p.shortDescription, search) > 0)
      filtered.sort((a, b) => getRelevanceScore(b.name, b.shortDescription, search) - getRelevanceScore(a.name, a.shortDescription, search))
    }

    if (needsOriginPostFetch) {
      filtered = filtered.filter((p) => {
        if (!p.origin) return false
        const pOriginLower = p.origin.toLowerCase()
        return originList.some(o => pOriginLower.includes(o.toLowerCase()))
      })
    }

    if (minRating !== null) {
      const targetRating = parseFloat(minRating)
      filtered = filtered.filter((p) => {
        if (p.reviews.length === 0) return false
        const avg = p.reviews.reduce((acc: number, rev: { rating: number }) => acc + rev.rating, 0) / p.reviews.length
        return avg >= targetRating
      })
    }

    if (minDiscount !== null && parseFloat(minDiscount) > 0) {
      const targetDisc = parseFloat(minDiscount)
      filtered = filtered.filter((p) => {
        if (!p.discountPrice) return false
        const discountPct = ((p.price - p.discountPrice) / p.price) * 100
        return discountPct >= targetDisc
      })
    }

    if (sortRaw === 'rating') {
      filtered.sort((a, b) => {
        const avgA = a.reviews.length ? a.reviews.reduce((sum: number, r: {rating: number}) => sum + r.rating, 0) / a.reviews.length : 0
        const avgB = b.reviews.length ? b.reviews.reduce((sum: number, r: {rating: number}) => sum + r.rating, 0) / b.reviews.length : 0
        return avgB - avgA
      })
    }

    total = filtered.length
    products = filtered.slice(skip, skip + limit)
  } else {
    const [fetchedProducts, fetchedTotal] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          category: true,
          subcategory: true,
          reviews: { where: { isApproved: true }, select: { rating: true } },
        },
        orderBy: prismaOrderBy,
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ])
    products = fetchedProducts
    total = fetchedTotal
  }

  let facets: any = undefined
  if (includeFacets) {
    const [categoryFacets, priceRange, brandFacets] = await Promise.all([
      db.product.groupBy({ by: ['categoryId'], where, _count: { categoryId: true } }),
      db.product.aggregate({ where, _min: { price: true }, _max: { price: true } }),
      db.product.groupBy({ by: ['origin'], where: { ...where, origin: { not: null } }, _count: { origin: true } }),
    ])

    const categoryIds = categoryFacets.map((cf) => cf.categoryId).filter(Boolean) as string[]
    const categoryDetails = await db.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, slug: true },
    })

    facets = {
      categories: categoryFacets.map((cf) => {
        const detail = categoryDetails.find((d) => d.id === cf.categoryId)
        return { id: detail?.id, name: detail?.name, slug: detail?.slug, count: cf._count.categoryId }
      }).filter(cf => cf.name),
      priceRange: { min: priceRange._min.price || 0, max: priceRange._max.price || 10000 },
      origins: brandFacets.map((bf) => ({ name: bf.origin, count: bf._count.origin })).filter(bf => bf.name),
    }
  }

  return {
    success: true,
    data: paginatedResponse(products, total, page, limit),
    facets,
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const role = await getUserRoleFromRequest(request)
    const isAdminUser = isAdmin(role)
    const cacheKey = `products:${isAdminUser ? 'admin' : 'public'}:${url.search}`

    // Call layered fetcher
    const responseData = await getCachedData(
      { key: cacheKey, tags: ['products'], revalidate: 600 },
      async () => fetchProductsData(url, request)
    )

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Get products error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function getRelevanceScore(name: string, shortDescription: string | null, search: string): number {
  const lowerName = name.toLowerCase()
  const lowerSearch = search.toLowerCase()
  let score = 0
  if (lowerName === lowerSearch) score += 100
  else if (lowerName.startsWith(lowerSearch)) score += 80
  else if (lowerName.includes(lowerSearch)) score += 60
  
  if (shortDescription && shortDescription.toLowerCase().includes(lowerSearch)) {
    score += 40
  }
  
  const searchWords = lowerSearch.split(' ')
  for (const word of searchWords) {
    if (word.length > 2) {
      if (lowerName.includes(word)) score += 20
      if (shortDescription && shortDescription.toLowerCase().includes(word)) score += 10
    }
  }
  return score
}

export async function POST(request: NextRequest) {
  try {
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name, slug, shortDescription, description, price, discountPrice,
      unit, stock, categoryId, subcategoryId, isFeatured, isBestSeller,
      isNewArrival, status, images, tags, specifications,
      origin, qualityNote, ingredients, storageInstruction, deliveryNote,
      metaTitle, metaDescription, metaKeywords,
    } = body

    if (!name || !price || !categoryId || !unit) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const productSlug = slug || slugify(name)
    const existingProduct = await db.product.findUnique({ where: { slug: productSlug } })
    if (existingProduct) {
      return NextResponse.json({ success: false, error: 'Product with this slug already exists' }, { status: 400 })
    }

    const product = await db.product.create({
      data: {
        name,
        slug: productSlug,
        shortDescription,
        description,
        price: parseFloat(price),
        discountPrice: discountPrice ? parseFloat(discountPrice) : null,
        unit,
        stock: parseInt(stock),
        categoryId,
        subcategoryId,
        isFeatured: isFeatured || false,
        isBestSeller: isBestSeller || false,
        isNewArrival: isNewArrival || false,
        status: status || 'active',
        tags: Array.isArray(tags) ? tags.join(',') : tags,
        specifications: typeof specifications === 'object' ? JSON.stringify(specifications) : specifications,
        origin,
        qualityNote,
        ingredients,
        storageInstruction,
        deliveryNote,
        metaTitle,
        metaDescription,
        metaKeywords,
        images: images && images.length > 0 ? {
          create: images.map((img: { url: string; alt?: string; sortOrder?: number; isFeatured?: boolean }, index: number) => ({
            url: img.url,
            alt: img.alt || null,
            sortOrder: img.sortOrder ?? index,
            isFeatured: img.isFeatured ?? index === 0,
          }))
        } : undefined
      },
      include: { images: true }
    })

    await invalidateCache(['products'], ['products'])

    const userId = await getUserIdFromRequest(request)
    if (userId) {
      await createAuditLog({
        adminId: userId,
        module: 'products',
        action: 'CREATE',
        referenceId: product.id,
        newData: { name: product.name }
      })
    }

    return NextResponse.json({ success: true, data: product }, { status: 201 })
  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
