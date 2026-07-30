import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCachedData, invalidateCache } from '@/lib/cache'
import { getUserRoleFromRequest, isAdmin } from '@/lib/utils'
import { deleteManagedMedia } from '@/lib/media'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const banner = await db.banner.findUnique({ where: { id } })

    if (!banner) {
      return NextResponse.json(
        { success: false, error: 'Banner not found' },
        { status: 404 }
      )
    }

    await invalidateCache(['banners'], ['banners']);
    return NextResponse.json({ success: true, data: banner })
  } catch (error) {
    console.error('Get banner error:', error)
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
      'title', 'subtitle', 'description', 'desktopImage', 'mobileImage',
      'link', 'ctaText', 'ctaLink', 'bgColor', 'textColor', 'location',
    ]
    for (const field of fields) {
      if (body[field] !== undefined) data[field] = body[field]
    }
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null

    const banner = await db.banner.update({ where: { id }, data })

    await invalidateCache(['banners'], ['banners']);
    return NextResponse.json({ success: true, data: banner })
  } catch (error) {
    console.error('Update banner error:', error)
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
    const banner = await db.banner.findUnique({
      where: { id },
      select: { desktopImage: true, mobileImage: true },
    })
    await db.banner.delete({ where: { id } })
    await deleteManagedMedia([banner?.desktopImage, banner?.mobileImage])

    await invalidateCache(['banners'], ['banners']);
    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete banner error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
