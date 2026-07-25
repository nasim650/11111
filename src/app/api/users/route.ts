import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin, getPaginationParams, paginatedResponse } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const { page, limit, skip } = getPaginationParams(url)
    const search = url.searchParams.get('search')
    const roleFilter = url.searchParams.get('role')

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    }
    if (roleFilter) where.role = roleFilter

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isVerified: true,
          avatar: true,
          isActive: true,
          createdAt: true,
          _count: { select: { orders: true, reviews: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: paginatedResponse(users, total, page, limit),
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
