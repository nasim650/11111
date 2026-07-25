import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const page = await db.policyPage.findUnique({ where: { slug } })

    if (!page || !page.isActive) {
      return NextResponse.json(
        { success: false, error: 'Policy page not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: page })
  } catch (error) {
    console.error('Get policy page by slug error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
