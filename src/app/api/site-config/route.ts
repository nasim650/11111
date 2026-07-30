import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin } from '@/lib/utils'
import { getCachedData, invalidateCache } from '@/lib/cache'

const SENSITIVE_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_from', 'smtp_pass', 'google_analytics_id']

export async function GET(request: NextRequest) {
  try {
    const role = await getUserRoleFromRequest(request)
    const isAdminUser = isAdmin(role)
    const cacheKey = `site-config:${isAdminUser ? 'admin' : 'public'}`

    const responseData = await getCachedData(
      { key: cacheKey, tags: ['site-config'], revalidate: 3600 },
      async () => {
        const configs = await db.siteConfig.findMany({
          orderBy: [{ group: 'asc' }, { key: 'asc' }],
        })

        if (isAdminUser) {
          return { success: true, data: configs }
        }

        const filteredConfigs = configs.filter(c => !SENSITIVE_KEYS.includes(c.key))
        return { success: true, data: filteredConfigs }
      }
    )

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
    await invalidateCache(['site-config:admin', 'site-config:public'], ['site-config'])

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
