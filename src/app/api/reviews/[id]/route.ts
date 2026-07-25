import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, isAdmin } from '@/lib/utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Ownership check: non-admin users can only update their own reviews
    if (!isAdmin(authUser.role)) {
      const review = await db.review.findUnique({ where: { id }, select: { userId: true } })
      if (!review || review.userId !== authUser.userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: you can only update your own reviews' },
          { status: 403 }
        )
      }
    }
    const body = await request.json()
    const { isApproved, isActive } = body

    const data: Record<string, unknown> = {}
    if (isApproved !== undefined) data.isApproved = isApproved
    if (isActive !== undefined) data.isActive = isActive

    const review = await db.review.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ success: true, data: review })
  } catch (error) {
    console.error('Update review error:', error)
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
    const authUser = await getUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Ownership check: non-admin users can only delete their own reviews
    if (!isAdmin(authUser.role)) {
      const review = await db.review.findUnique({ where: { id }, select: { userId: true } })
      if (!review || review.userId !== authUser.userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: you can only delete your own reviews' },
          { status: 403 }
        )
      }
    }

    await db.review.delete({ where: { id } })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete review error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
