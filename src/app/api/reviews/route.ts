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
    const isActive = url.searchParams.get('isActive')
    const status = url.searchParams.get('status')
    const checkEligibility = url.searchParams.get('checkEligibility')

    // ── Eligibility Check for Product Detail Page ──
    if (checkEligibility === 'true') {
      if (!productId) {
        return NextResponse.json(
          { success: false, error: 'Product ID is required for eligibility check' },
          { status: 400 }
        )
      }
      const authUser = await getUserFromRequest(request)
      if (!authUser) {
        return NextResponse.json({
          success: true,
          data: {
            canReview: false,
            isAuthenticated: false,
            reason: 'NOT_AUTHENTICATED',
            message: 'রিভিউ লেখার জন্য অনুগ্রহ করে লগইন করুন।',
          },
        })
      }

      // Check if user has already reviewed this product
      const existingReview = await db.review.findFirst({
        where: { userId: authUser.userId, productId },
      })
      if (existingReview) {
        return NextResponse.json({
          success: true,
          data: {
            canReview: false,
            isAuthenticated: true,
            alreadyReviewed: true,
            hasDeliveredOrder: true,
            reason: 'ALREADY_REVIEWED',
            message: 'আপনি ইতিমধ্যে এই পণ্যটিতে রিভিউ দিয়েছেন। আপনার মতামত আমাদের জন্য মূল্যবান!',
          },
        })
      }

      // Check if customer has an order for this product with terminal status 'delivered'
      const deliveredOrder = await db.order.findFirst({
        where: {
          userId: authUser.userId,
          orderStatus: 'delivered',
          items: {
            some: { productId },
          },
        },
      })

      if (!deliveredOrder) {
        return NextResponse.json({
          success: true,
          data: {
            canReview: false,
            isAuthenticated: true,
            alreadyReviewed: false,
            hasDeliveredOrder: false,
            reason: 'NOT_DELIVERED',
            message: 'এই পণ্যটি আপনার কাছে সফলভাবে ডেলিভারি হওয়ার পর review দিতে পারবেন।',
          },
        })
      }

      return NextResponse.json({
        success: true,
        data: {
          canReview: true,
          isAuthenticated: true,
          alreadyReviewed: false,
          hasDeliveredOrder: true,
        },
      })
    }

    // ── Standard Reviews Query ──
    const where: Record<string, unknown> = {}
    if (productId) where.productId = productId
    if (userId) where.userId = userId

    const authUser = await getUserFromRequest(request)
    const isAdminUser = Boolean(authUser && (authUser.role === 'admin' || authUser.role === 'manager'))

    if (isAdminUser) {
      if (status === 'approved') {
        where.isApproved = true
        where.isActive = true
      } else if (status === 'pending') {
        where.isApproved = false
        where.isActive = true
      } else if (status === 'rejected') {
        where.isActive = false
      } else if (status === 'all') {
        // No filter on isApproved or isActive
      } else {
        if (isActive !== null) where.isActive = isActive === 'true'
        if (isApproved !== null) where.isApproved = isApproved === 'true'
      }
    } else {
      // Public / non-admin queries ONLY return approved and active reviews
      where.isApproved = true
      where.isActive = true
    }

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
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

    // 1. Ownership & authentication check: verify userId matches authenticated user
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

    // 2. Preflight duplicate check: single review per product per customer
    const existingReview = await db.review.findFirst({
      where: { userId, productId },
    })
    if (existingReview) {
      return NextResponse.json(
        { success: false, error: 'You have already reviewed this product' },
        { status: 400 }
      )
    }

    // 3. Verified Delivered Purchase check:
    // Customer can review a product ONLY if they have an order for that product with status 'delivered'
    // (terminal state; not just 'paid', so delivered COD orders qualify).
    const isPrivileged = authUser.role === 'admin' || authUser.role === 'manager'
    if (!isPrivileged) {
      const deliveredOrder = await db.order.findFirst({
        where: {
          userId,
          orderStatus: 'delivered',
          items: {
            some: {
              productId,
            },
          },
        },
      })

      if (!deliveredOrder) {
        return NextResponse.json(
          {
            success: false,
            error: 'এই পণ্যটি আপনার কাছে সফলভাবে ডেলিভারি হওয়ার পর review দিতে পারবেন।',
          },
          { status: 403 }
        )
      }
    }

    // 4. Create review with defaults:
    // isApproved=false (requires admin moderation), isActive=true, isVerified=true
    const review = await db.review.create({
      data: {
        userId,
        productId,
        rating,
        comment,
        isApproved: false,
        isActive: true,
        isVerified: true,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
    })

    return NextResponse.json({ success: true, data: review }, { status: 201 })
  } catch (error) {
    console.error('Create review error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
