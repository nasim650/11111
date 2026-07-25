import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin, slugify } from '@/lib/utils'
import { deleteManagedMedia } from '@/lib/media'

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
    const { name, slug, categoryId, description, image, sortOrder, isActive } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) { data.name = name; data.slug = slug || slugify(name) }
    if (slug !== undefined) data.slug = slug
    if (categoryId !== undefined) data.categoryId = categoryId
    if (description !== undefined) data.description = description
    if (image !== undefined) data.image = image
    if (sortOrder !== undefined) data.sortOrder = sortOrder
    if (isActive !== undefined) data.isActive = isActive

    const subcategory = await db.subcategory.update({ where: { id }, data })

    return NextResponse.json({ success: true, data: subcategory })
  } catch (error) {
    console.error('Update subcategory error:', error)
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
    const subcategory = await db.subcategory.findUnique({
      where: { id },
      select: { image: true },
    })
    await db.subcategory.delete({ where: { id } })
    await deleteManagedMedia([subcategory?.image])

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete subcategory error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
