import { redis } from '@/lib/redis'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

function inMemoryRateLimit(
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

/**
 * A Redis fixed-window limiter shared by every serverless instance.
 * Local development still works without Redis, but production must set
 * REDIS_URL for rate limits to survive cold starts and horizontal scaling.
 */
export async function rateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60 * 1000
): Promise<RateLimitResult> {
  if (!redis) return inMemoryRateLimit(key, limit, windowMs)

  try {
    const redisKey = `rate-limit:${key}`
    const count = await redis.incr(redisKey)
    if (count === 1) await redis.pexpire(redisKey, windowMs)

    const ttl = await redis.pttl(redisKey)
    const reset = Date.now() + (ttl > 0 ? ttl : windowMs)
    return {
      success: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      reset,
    }
  } catch (error) {
    // Availability should not take the whole storefront down. The deployment
    // checklist flags this fallback as unsuitable for multi-instance prod.
    console.error('Redis rate limit failed; using local fallback:', error)
    return inMemoryRateLimit(key, limit, windowMs)
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
