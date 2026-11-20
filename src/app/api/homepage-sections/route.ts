import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin, getPaginationParams, paginatedResponse } from '@/lib/utils'
import { csrfGuard, rateLimitOrResponse } from '@/lib/security'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const { page, limit, skip } = getPaginationParams(url)
    const role = await getUserRoleFromRequest(request)
    const adminView = isAdmin(role) && url.searchParams.get('admin') === 'true'
    const type = url.searchParams.get('type')
    const isActiveParam = url.searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (type) where.type = type

    if (adminView) {
      if (isActiveParam !== null) where.isActive = isActiveParam === 'true'
    } else {
      where.isActive = true
    }

    const [sections, total] = await Promise.all([
      db.homepageSection.findMany({
        where,
        include: { category: { select: { id: true, name: true, slug: true } } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      db.homepageSection.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: paginatedResponse(sections, total, page, limit),
    })
  } catch (error) {
    console.error('Get homepage sections error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrf = csrfGuard(request)
    if (csrf) return csrf
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const limited = await rateLimitOrResponse(request, 'homepage-sections-write', 20, 60 * 1000)
    if (limited) return limited

    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title || title.length > 200) {
      return NextResponse.json({ success: false, error: 'Title is required (max 200 chars)' }, { status: 400 })
    }

    const allowedTypes = ['product_grid', 'banner', 'category', 'custom', 'testimonial', 'features', 'promo', 'seasonal', 'trust']
    const type = allowedTypes.includes(body.type) ? body.type : 'custom'

    const section = await db.homepageSection.create({
      data: {
        title,
        type,
        subtitle: typeof body.subtitle === 'string' ? body.subtitle.trim() : null,
        description: typeof body.description === 'string' ? body.description.trim() : null,
        categoryId: typeof body.categoryId === 'string' ? body.categoryId : null,
        content: typeof body.content === 'string' ? body.content : null,
        image: typeof body.image === 'string' ? body.image.trim() : null,
        bgColor: typeof body.bgColor === 'string' ? body.bgColor.trim() : null,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
        isActive: body.isActive !== false,
        layout: typeof body.layout === 'string' ? body.layout : 'grid',
        limit: typeof body.limit === 'number' ? Math.min(body.limit, 50) : 8,
      },
    })

    return NextResponse.json({ success: true, data: section }, { status: 201 })
  } catch (error) {
    console.error('Create homepage section error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
