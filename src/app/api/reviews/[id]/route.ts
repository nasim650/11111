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
    const review = await db.review.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })

    if (!review) {
      return NextResponse.json(
        { success: false, error: 'Review not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const isUserAdmin = isAdmin(authUser.role)

    // ── Non-admin customer updating their review ──
    if (!isUserAdmin) {
      if (review.userId !== authUser.userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: you can only update your own reviews' },
          { status: 403 }
        )
      }

      // Customers CANNOT self-approve, self-activate, or tamper with verification
      if (
        body.isApproved !== undefined ||
        body.isActive !== undefined ||
        body.isVerified !== undefined ||
        body.status !== undefined
      ) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: customers cannot modify review approval or status' },
          { status: 403 }
        )
      }

      const data: Record<string, unknown> = {}
      if (typeof body.rating === 'number' && body.rating >= 1 && body.rating <= 5) {
        data.rating = Math.round(body.rating)
      }
      if (typeof body.comment === 'string') {
        data.comment = body.comment
      }
      // Re-editing a review resets it to unapproved pending admin moderation
      data.isApproved = false

      const updated = await db.review.update({
        where: { id },
        data,
        include: { user: { select: { id: true, name: true } } },
      })
      return NextResponse.json({ success: true, data: updated })
    }

    // ── Admin / Manager Moderation ──
    const data: Record<string, unknown> = {}
    if (body.status === 'approved') {
      data.isApproved = true
      data.isActive = true
    } else if (body.status === 'rejected') {
      data.isApproved = false
      data.isActive = false
    } else if (body.status === 'pending') {
      data.isApproved = false
      data.isActive = true
    }

    if (body.isApproved !== undefined) data.isApproved = Boolean(body.isApproved)
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.isVerified !== undefined) data.isVerified = Boolean(body.isVerified)

    const updatedReview = await db.review.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ success: true, data: updatedReview })
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
    const review = await db.review.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })

    if (!review) {
      return NextResponse.json(
        { success: false, error: 'Review not found' },
        { status: 404 }
      )
    }

    // Ownership check: non-admin users can only delete their own reviews
    if (!isAdmin(authUser.role)) {
      if (review.userId !== authUser.userId) {
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
