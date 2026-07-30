import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCachedData, invalidateCache } from '@/lib/cache'
import { getUserRoleFromRequest, isAdmin, slugify } from '@/lib/utils'
import { deleteManagedMedia } from '@/lib/media'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const category = await db.category.findUnique({
      where: { id },
      include: { subcategories: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      )
    }

    await invalidateCache(['categories'], ['categories']);
    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error('Get category error:', error)
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
    const { name, slug, description, image, icon, bannerImage, metaTitle, metaDescription, metaKeywords, sortOrder, isActive, showInMenu, showInHome } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) { data.name = name; data.slug = slug || slugify(name) }
    if (slug !== undefined) data.slug = slug
    if (description !== undefined) data.description = description
    if (image !== undefined) data.image = image
    if (icon !== undefined) data.icon = icon
    if (bannerImage !== undefined) data.bannerImage = bannerImage
    if (metaTitle !== undefined) data.metaTitle = metaTitle
    if (metaDescription !== undefined) data.metaDescription = metaDescription
    if (metaKeywords !== undefined) data.metaKeywords = metaKeywords
    if (sortOrder !== undefined) data.sortOrder = sortOrder
    if (isActive !== undefined) data.isActive = isActive
    if (showInMenu !== undefined) data.showInMenu = showInMenu
    if (showInHome !== undefined) data.showInHome = showInHome

    const category = await db.category.update({ where: { id }, data })

    await invalidateCache(['categories'], ['categories']);
    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error('Update category error:', error)
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
    const category = await db.category.findUnique({
      where: { id },
      select: {
        image: true,
        icon: true,
        bannerImage: true,
        subcategories: { select: { image: true } },
      },
    })
    await db.category.delete({ where: { id } })
    await deleteManagedMedia([
      category?.image,
      category?.icon,
      category?.bannerImage,
      ...(category?.subcategories.map((subcategory) => subcategory.image) ?? []),
    ])

    await invalidateCache(['categories'], ['categories']);
    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
