import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const config = await db.siteConfig.findUnique({ where: { key } })

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Config not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('Get site config error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { key } = await params
    const body = await request.json()
    const { value, type, group, label } = body

    const existing = await db.siteConfig.findUnique({ where: { key } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Config not found' },
        { status: 404 }
      )
    }

    const config = await db.siteConfig.update({
      where: { key },
      data: {
        ...(value !== undefined && { value }),
        ...(type && { type }),
        ...(group && { group }),
        ...(label !== undefined && { label }),
      },
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('Update site config error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { key } = await params
    await db.siteConfig.delete({ where: { key } })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete site config error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
