import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const page = await db.policyPage.findUnique({ where: { id } })

    if (!page) {
      return NextResponse.json(
        { success: false, error: 'Policy page not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: page })
  } catch (error) {
    console.error('Get policy page error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    const data: Record<string, unknown> = {}
    const fields = ['slug', 'title', 'content', 'metaTitle', 'metaDescription', 'metaKeywords']
    for (const field of fields) {
      if (body[field] !== undefined) data[field] = body[field]
    }
    if (body.isActive !== undefined) data.isActive = body.isActive

    const page = await db.policyPage.update({ where: { id }, data })

    return NextResponse.json({ success: true, data: page })
  } catch (error) {
    console.error('Update policy page error:', error)
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
    const role = await getUserRoleFromRequest(request)
    if (!isAdmin(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
    await db.policyPage.delete({ where: { id } })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete policy page error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
