import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, isAdmin } from '@/lib/utils'

export async function GET(
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

    const message = await db.contactMessage.findUnique({
      where: { id },
    })

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: message })
  } catch (error) {
    console.error('Get contact message error:', error)
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
    const body = await request.json().catch(() => ({}))
    const isRead = body.isRead !== undefined ? Boolean(body.isRead) : true

    const message = await db.contactMessage.update({
      where: { id },
      data: { isRead },
    })

    return NextResponse.json({ success: true, data: message })
  } catch (error) {
    console.error('Update contact message error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const body = await request.json().catch(() => ({}))

    // Toggle isRead: if body.isRead is provided use it, otherwise toggle current value
    if (body.isRead !== undefined) {
      const message = await db.contactMessage.update({
        where: { id },
        data: { isRead: Boolean(body.isRead) },
      })
      return NextResponse.json({ success: true, data: message })
    }

    // Toggle: fetch current and flip
    const current = await db.contactMessage.findUnique({ where: { id } })
    if (!current) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      )
    }

    const message = await db.contactMessage.update({
      where: { id },
      data: { isRead: !current.isRead },
    })

    return NextResponse.json({ success: true, data: message })
  } catch (error) {
    console.error('Toggle contact message read status error:', error)
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

    await db.contactMessage.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Message deleted' })
  } catch (error) {
    console.error('Delete contact message error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
