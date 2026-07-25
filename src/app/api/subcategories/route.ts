import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin, slugify, getPaginationParams, paginatedResponse } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const { page, limit, skip } = getPaginationParams(url)
    const categoryId = url.searchParams.get('categoryId')
    const isActive = url.searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (categoryId) where.categoryId = categoryId
    if (isActive !== null) where.isActive = isActive === 'true'

    const [subcategories, total] = await Promise.all([
      db.subcategory.findMany({
        where,
        include: { category: true },
        orderBy: { sortOrder: 'asc' },
        skip,
        take: limit,
      }),
      db.subcategory.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: paginatedResponse(subcategories, total, page, limit),
    })
  } catch (error) {
    console.error('Get subcategories error:', error)
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
    const { name, slug, categoryId, description, image, sortOrder, isActive } = body

    if (!name || !categoryId) {
      return NextResponse.json(
        { success: false, error: 'Name and categoryId are required' },
        { status: 400 }
      )
    }

    const subcategory = await db.subcategory.create({
      data: {
        name,
        slug: slug || slugify(name),
        categoryId,
        description: description || null,
        image: image || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json({ success: true, data: subcategory }, { status: 201 })
  } catch (error) {
    console.error('Create subcategory error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
