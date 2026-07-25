import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin, slugify } from '@/lib/utils'

export async function GET() {
  try {
    const pages = await db.policyPage.findMany({
      where: { isActive: true },
      orderBy: { title: 'asc' },
    })

    return NextResponse.json({ success: true, data: pages })
  } catch (error) {
    console.error('Get policy pages error:', error)
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
    const { slug, title, content, metaTitle, metaDescription, metaKeywords, isActive } = body

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: 'Title and content are required' },
        { status: 400 }
      )
    }

    const page = await db.policyPage.create({
      data: {
        slug: slug || slugify(title),
        title,
        content,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        metaKeywords: metaKeywords || null,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json({ success: true, data: page }, { status: 201 })
  } catch (error) {
    console.error('Create policy page error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
