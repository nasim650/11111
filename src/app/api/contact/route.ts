import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin, getPaginationParams, paginatedResponse } from '@/lib/utils'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateContact, validationError } from '@/lib/validation'

// Valid subject categories
const SUBJECT_CATEGORIES = [
  'General Inquiry',
  'Product Question',
  'Delivery Issue',
  'Return/Refund',
  'Partnership',
  'Other',
] as const

// Simple in-memory rate limiter: max 3 submissions per email per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const MAX_SUBMISSIONS_PER_HOUR = 3
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkRateLimit(email: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(email)

  // Clean up expired entries
  if (entry && now >= entry.resetAt) {
    rateLimitMap.delete(email)
  }

  const current = rateLimitMap.get(email)

  if (!current) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS
    rateLimitMap.set(email, { count: 1, resetAt })
    return { allowed: true, remaining: MAX_SUBMISSIONS_PER_HOUR - 1, resetAt }
  }

  if (current.count >= MAX_SUBMISSIONS_PER_HOUR) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt }
  }

  current.count += 1
  return { allowed: true, remaining: MAX_SUBMISSIONS_PER_HOUR - current.count, resetAt: current.resetAt }
}

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
    const isRead = url.searchParams.get('isRead')

    const where: Record<string, unknown> = {}
    if (isRead !== null) where.isRead = isRead === 'true'

    const [messages, total] = await Promise.all([
      db.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.contactMessage.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: paginatedResponse(messages, total, page, limit),
    })
  } catch (error) {
    console.error('Get contact messages error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // IP-based rate limiting: 3 messages per minute per IP
    const clientIp = getClientIp(request)
    const ipRateLimitResult = await rateLimit(`contact:${clientIp}`, 3, 60 * 1000)
    if (!ipRateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((ipRateLimitResult.reset - Date.now()) / 1000)) } }
      )
    }

    const body = await request.json()
    const validated = validateContact(body)
    if (!validated.ok) {
      return NextResponse.json(
        validationError(validated.errors),
        { status: 400 }
      )
    }
    const { name, email, phone, subject, message } = validated.data

    if (name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Name is required and must be at least 2 characters long' },
        { status: 400 }
      )
    }

    if (!subject || !SUBJECT_CATEGORIES.includes(subject as typeof SUBJECT_CATEGORIES[number])) {
      return NextResponse.json(
        { success: false, error: `Subject is required. Valid categories: ${SUBJECT_CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }

    if (message.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Message is required and must be at least 10 characters long' },
        { status: 400 }
      )
    }

    // --- Rate Limiting ---
    const rateLimitResult = checkRateLimit(email)
    if (!rateLimitResult.allowed) {
      const resetDate = new Date(rateLimitResult.resetAt)
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. You can submit a maximum of ${MAX_SUBMISSIONS_PER_HOUR} messages per hour. Please try again after ${resetDate.toLocaleTimeString()}.`,
        },
        { status: 429 }
      )
    }

    // Create contact message
    const contactMessage = await db.contactMessage.create({
      data: {
        name,
        email,
        phone,
        subject,
        message,
      },
    })



    return NextResponse.json(
      {
        success: true,
        data: contactMessage,
        message: 'Thank you for contacting us! We will get back to you within 24 hours.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create contact message error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
