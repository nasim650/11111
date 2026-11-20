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
    const isActiveParam = url.searchParams.get('isActive')
    const category = url.searchParams.get('category')

    const where: Record<string, unknown> = {}
    if (category) where.category = category

    if (adminView) {
      // Admin sees all; optionally filter by isActive
      if (isActiveParam !== null) where.isActive = isActiveParam === 'true'
    } else {
      // Public: only active FAQ items
      where.isActive = true
    }

    const [items, total] = await Promise.all([
      db.fAQItem.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      db.fAQItem.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: paginatedResponse(items, total, page, limit),
    })
  } catch (error) {
    console.error('Get FAQ error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrf = csrfGuard(request)
    if (csrf) return csrf
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    const limited = await rateLimitOrResponse(request, 'faq-write', 20, 60 * 1000)
    if (limited) return limited

    const body = await request.json()
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    const answer = typeof body.answer === 'string' ? body.answer.trim() : ''
    const category = typeof body.category === 'string' ? body.category.trim() : null
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : 0
    const isActive = body.isActive !== false

    if (!question || question.length > 500) {
      return NextResponse.json({ success: false, error: 'Question is required and must be under 500 characters' }, { status: 400 })
    }
    if (!answer || answer.length > 2000) {
      return NextResponse.json({ success: false, error: 'Answer is required and must be under 2000 characters' }, { status: 400 })
    }

    const item = await db.fAQItem.create({
      data: { question, answer, category: category || null, sortOrder, isActive },
    })

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error) {
    console.error('Create FAQ error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
