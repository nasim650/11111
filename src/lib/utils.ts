import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a URL-friendly slug from a string
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/&/g, '-and-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

/**
 * Generate a unique order number like KK-YYYYMMDD-NNNNN
 * Uses timestamp + random to avoid collisions under concurrent load
 */
export function generateOrderNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `KK-${year}${month}${day}-${random}`
}

/**
 * Parse pagination params from request URL
 */
export function getPaginationParams(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10')))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

/**
 * Check if a user has admin role
 */
export function isAdmin(role?: string | null): boolean {
  return role === 'admin' || role === 'manager'
}

/**
 * Get user (id + role) from JWT token in Authorization header
 * Looks up user from DB to get current role
 */
export async function getUserFromRequest(request: Request): Promise<{ userId: string; role: string } | null> {
  const authHeader = request.headers.get('Authorization')
  const cookieHeader = request.headers.get('cookie') || ''
  const cookieToken = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('auth_token='))
    ?.split('=')
    .slice(1)
    .join('=')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : cookieToken
  if (!token) return null

  const { verifyToken } = await import('@/lib/auth')
  const payload = await verifyToken(token)
  if (!payload?.userId) return null

  // Look up user from DB to get current role
  const { db } = await import('@/lib/db')
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true }
  })

  return user ? { userId: user.id, role: user.role } : null
}

/**
 * Get user ID from request - wrapper around getUserFromRequest
 */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const user = await getUserFromRequest(request)
  return user?.userId || null
}

/**
 * Get user role from request - wrapper around getUserFromRequest
 */
export async function getUserRoleFromRequest(request: Request): Promise<string | null> {
  const user = await getUserFromRequest(request)
  return user?.role || null
}

/**
 * Parse a JSON string safely
 */
export function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback
  try {
    return JSON.parse(str) as T
  } catch {
    return fallback
  }
}
