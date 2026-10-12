import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPaginationParams, paginatedResponse, getUserFromRequest } from '@/lib/utils'
import { rateLimitOrResponse } from '@/lib/security'
import { validateReview, validationError } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const { page, limit, skip } = getPaginationParams(url)
    const productId = url.searchParams.get('productId')
    const userId = url.searchParams.get('userId')
    const isApproved = url.searchParams.get('isApproved')

    const where: Record<string, unknown> = {}
    if (productId) where.productId = productId
    if (userId) where.userId = userId
    if (isApproved !== null) where.isApproved = isApproved === 'true'
    else where.isApproved = true // Default: only approved

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.review.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: paginatedResponse(reviews, total, page, limit),
    })
  } catch (error) {
    console.error('Get reviews error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitOrResponse(request, 'reviews', 5, 60 * 1000)
    if (limited) return limited

    const body = await request.json()
    const validated = validateReview(body)
    if (!validated.ok) {
      return NextResponse.json(
        validationError(validated.errors),
        { status: 400 }
      )
    }
    const { userId, productId, rating, comment } = validated.data

    // Ownership check: verify the userId matches authenticated user
    const authUser = await getUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    if (authUser.role !== 'admin' && authUser.role !== 'manager' && authUser.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: you can only submit reviews as yourself' },
        { status: 403 }
      )
    }

    // Check if user already reviewed this product
    const existingReview = await db.review.findFirst({
      where: { userId, productId },
    })
    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this product' },
        { status: 409 }
      )
    }

    const review = await db.review.create({
      data: {
        userId,
        productId,
        rating,
        comment,
      },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    })

    // Check if user has purchased the product (verified purchaser)
    const hasPurchased = await db.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          paymentStatus: 'paid',
        },
      },
    })

    await db.review.update({
      where: { id: review.id },
      data: { isVerified: !!hasPurchased },
    })

    // Return the updated review with isVerified
    const updatedReview = await db.review.findUnique({
      where: { id: review.id },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    })

    return NextResponse.json({ success: true, data: updatedReview }, { status: 201 })
  } catch (error) {
    console.error('Create review error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
