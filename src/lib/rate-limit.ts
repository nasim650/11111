const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export function rateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60 * 1000
): RateLimitResult {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: now + windowMs,
    }
  }

  if (record.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: record.resetTime,
    }
  }

  record.count++
  return {
    success: true,
    limit,
    remaining: limit - record.count,
    reset: record.resetTime,
  }
}

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Extract client IP from request headers
 */
export function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}
