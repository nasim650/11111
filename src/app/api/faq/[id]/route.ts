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
    const limited = await rateLimitOrResponse(request, 'faq-write', 20, 60 * 1000)
    if (limited) return limited

    const { id } = await params
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (typeof body.question === 'string') data.question = body.question.trim()
    if (typeof body.answer === 'string') data.answer = body.answer.trim()
    if (typeof body.category === 'string') data.category = body.category.trim() || null
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    const item = await db.fAQItem.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    console.error('Update FAQ error:', error)
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
    await db.fAQItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete FAQ error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
