import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserRoleFromRequest, getUserIdFromRequest, isAdmin } from '@/lib/utils'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const role = await getUserRoleFromRequest(request)
    const requestUserId = await getUserIdFromRequest(request)

    // Allow users to view their own profile, admins to view any profile
    if (!isAdmin(role) && requestUserId !== id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        addresses: true,
        _count: { select: { orders: true, reviews: true, wishlistItems: true, cartItems: true } },
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get order statistics
    const orderStats = await db.order.aggregate({
      where: { userId: id },
      _sum: { totalAmount: true },
      _count: true,
    })

    const totalSpent = orderStats._sum.totalAmount ?? 0
    const orderCount = orderStats._count

    // Get recent orders (last 5)
    const recentOrders = await db.order.findMany({
      where: { userId: id },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        orderStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        stats: {
          orderCount,
          totalSpent: Math.round(totalSpent * 100) / 100,
          wishlistCount: user._count.wishlistItems,
          cartCount: user._count.cartItems,
          reviewCount: user._count.reviews,
        },
        recentOrders,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
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
    const { id } = await params
    const role = await getUserRoleFromRequest(request)
    const requestUserId = await getUserIdFromRequest(request)

    // Allow users to update their own profile, admins to update any profile
    if (!isAdmin(role) && requestUserId !== id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name, email, phone, role: newRole, isVerified, isActive,
      avatar, currentPassword, newPassword,
    } = body

    const data: Record<string, unknown> = {}

    // Basic profile fields
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email
    if (phone !== undefined) data.phone = phone
    if (avatar !== undefined) data.avatar = avatar

    // Admin-only fields
    if (isAdmin(role)) {
      if (newRole !== undefined) data.role = newRole
      if (isVerified !== undefined) data.isVerified = isVerified
      if (isActive !== undefined) data.isActive = isActive
    }

    // Password change requires current password verification
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: 'Current password is required to set a new password' },
          { status: 400 }
        )
      }

      const user = await db.user.findUnique({
        where: { id },
        select: { password: true },
      })

      if (!user || !user.password) {
        return NextResponse.json(
          { success: false, error: 'User not found or no password set' },
          { status: 404 }
        )
      }

      const isPasswordValid = await verifyPassword(currentPassword, user.password)
      if (!isPasswordValid) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 400 }
        )
      }

      data.password = await hashPassword(newPassword)
    }

    const user = await db.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, isVerified: true, avatar: true, isActive: true,
        updatedAt: true,
      },
    })

    // Audit log for admin actions
    if (isAdmin(role) && requestUserId !== id) {
      await createAuditLog({
        adminId: requestUserId ?? undefined,
        action: 'update',
        module: 'users',
        referenceId: id,
        newData: user,
      })
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('Update user error:', error)
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
    await db.user.delete({ where: { id } })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
