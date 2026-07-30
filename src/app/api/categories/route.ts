import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin, slugify, getPaginationParams, paginatedResponse } from '@/lib/utils'
import { getCachedData, invalidateCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const { page, limit, skip } = getPaginationParams(url)
    const isActive = url.searchParams.get('isActive')
    const showInMenu = url.searchParams.get('showInMenu')
    const search = url.searchParams.get('search')

    // Build cache key from query params
    const cacheKey = `categories:${isActive || ''}:${showInMenu || ''}:${search || ''}:${page}:${limit}`
    

    const where: Record<string, unknown> = {}
    if (isActive !== null) where.isActive = isActive === 'true'
    if (showInMenu !== null) where.showInMenu = showInMenu === 'true'
    if (search) where.name = { contains: search }

    const [categories, total] = await getCachedData(
      { key: cacheKey, tags: ['categories'], revalidate: 600 },
      async () => {
        return Promise.all([
          db.category.findMany({
            where,
            include: { subcategories: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
            orderBy: { sortOrder: 'asc' },
            skip,
            take: limit,
          }),
          db.category.count({ where }),
        ])
      }
    )

    const responseData = {
      success: true,
      data: paginatedResponse(categories, total, page, limit),
    }
        return NextResponse.json(responseData)
  } catch (error) {
    console.error('Get categories error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
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
    const { name, slug, description, image, icon, bannerImage, metaTitle, metaDescription, metaKeywords, sortOrder, isActive, showInMenu, showInHome } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      )
    }

    const categorySlug = slug || slugify(name)

    const category = await db.category.create({
      data: {
        name,
        slug: categorySlug,
        description: description || null,
        image: image || null,
        icon: icon || null,
        bannerImage: bannerImage || null,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        metaKeywords: metaKeywords || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        showInMenu: showInMenu ?? true,
        showInHome: showInHome ?? true,
      },
    })

    // Invalidate categories cache on mutation
    await invalidateCache(['categories'], ['categories'])

    return NextResponse.json({ success: true, data: category }, { status: 201 })
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
