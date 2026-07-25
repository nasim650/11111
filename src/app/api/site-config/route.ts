import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin } from '@/lib/utils'
import { cache } from '@/lib/cache'

const SENSITIVE_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_from', 'smtp_pass', 'google_analytics_id']

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin to determine cache key
    const role = await getUserRoleFromRequest(request)
    const isAdminUser = isAdmin(role)
    const cacheKey = `site-config:${isAdminUser ? 'admin' : 'public'}`

    const cached = cache.get<unknown>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const configs = await db.siteConfig.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    })

    if (isAdminUser) {
      const responseData = {
        success: true,
        data: configs,
      }
      cache.set(cacheKey, responseData, 5 * 60 * 1000) // 5 min TTL
      return NextResponse.json(responseData)
    }

    // For public access, filter out sensitive config
    const filteredConfigs = configs.filter(c => !SENSITIVE_KEYS.includes(c.key))
    const responseData = {
      success: true,
      data: filteredConfigs,
    }
    cache.set(cacheKey, responseData, 5 * 60 * 1000) // 5 min TTL
    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Get site configs error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { key, value, type, group, label } = body

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, error: 'Key and value are required' },
        { status: 400 }
      )
    }

    const config = await db.siteConfig.upsert({
      where: { key },
      update: { value, type: type || 'text', group: group || 'general', label: label || null },
      create: { key, value, type: type || 'text', group: group || 'general', label: label || null },
    })

    // Invalidate site-config cache on mutation
    cache.invalidatePattern('site-config')

    return NextResponse.json({
      success: true,
      data: config,
    }, { status: 201 })
  } catch (error) {
    console.error('Create/update site config error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
