import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin, getPaginationParams, paginatedResponse } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const { page, limit, skip } = getPaginationParams(url)
    const location = url.searchParams.get('location')
    const isActiveParam = url.searchParams.get('isActive')
    const role = await getUserRoleFromRequest(request)
    const adminView = isAdmin(role) && url.searchParams.get('admin') === 'true'

    const where: Record<string, unknown> = {}
    if (location) where.location = location

    if (adminView) {
      // Admins managing banners see everything (filtered only by location if given)
      if (isActiveParam !== null) where.isActive = isActiveParam === 'true'
    } else {
      // Public: only active banners within their date range
      where.isActive = isActiveParam === null ? true : isActiveParam === 'true'
      const now = new Date()
      where.OR = [
        { startDate: null, endDate: null },
        { startDate: { lte: now }, endDate: { gte: now } },
        { startDate: { lte: now }, endDate: null },
        { startDate: null, endDate: { gte: now } },
      ]
    }

    const [banners, total] = await Promise.all([
      db.banner.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip,
        take: limit,
      }),
      db.banner.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: paginatedResponse(banners, total, page, limit),
    })
  } catch (error) {
    console.error('Get banners error:', error)
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
    const {
      title, subtitle, description, desktopImage, mobileImage, link,
      ctaText, ctaLink, bgColor, textColor, sortOrder, isActive,
      startDate, endDate, location,
    } = body

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    const banner = await db.banner.create({
      data: {
        title,
        subtitle: subtitle || null,
        description: description || null,
        desktopImage: desktopImage || null,
        mobileImage: mobileImage || null,
        link: link || null,
        ctaText: ctaText || null,
        ctaLink: ctaLink || null,
        bgColor: bgColor || null,
        textColor: textColor || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        location: location || 'hero',
      },
    })

    return NextResponse.json({ success: true, data: banner }, { status: 201 })
  } catch (error) {
    console.error('Create banner error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
