import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin } from '@/lib/utils'
import { csrfGuard, rateLimitOrResponse } from '@/lib/security'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrf = csrfGuard(request)
    if (csrf) return csrf
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const limited = await rateLimitOrResponse(request, 'homepage-sections-write', 20, 60 * 1000)
    if (limited) return limited

    const { id } = await params
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string') data.title = body.title.trim()
    if (typeof body.type === 'string') data.type = body.type
    if (typeof body.subtitle === 'string') data.subtitle = body.subtitle.trim() || null
    if (typeof body.description === 'string') data.description = body.description.trim() || null
    if (typeof body.image === 'string') data.image = body.image.trim() || null
    if (typeof body.bgColor === 'string') data.bgColor = body.bgColor.trim() || null
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive
    if (typeof body.categoryId === 'string') data.categoryId = body.categoryId || null
    if (typeof body.content === 'string') data.content = body.content || null
    if (typeof body.layout === 'string') data.layout = body.layout
    if (typeof body.limit === 'number') data.limit = Math.min(body.limit, 50)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    const section = await db.homepageSection.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: section })
  } catch (error) {
    console.error('Update homepage section error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrf = csrfGuard(request)
    if (csrf) return csrf
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    await db.homepageSection.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete homepage section error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
