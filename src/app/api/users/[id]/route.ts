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
        password: true,
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

    const hasPassword = user.password !== null
    const identityStatus = hasPassword ? 'registered_account' : 'guest_profile'
    const { password: _, ...userWithoutPassword } = user

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

    // Part D: Six-month customer activity analysis for admin/manager
    let sixMonthActivity: Record<string, unknown> | null = null
    if (isAdmin(role)) {
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
      const sixMonthOrders = await db.order.findMany({
        where: {
          createdAt: { gte: sixMonthsAgo },
          OR: [
            { userId: id },
            ...(user.phone ? [{ guestPhone: user.phone }] : []),
          ],
        },
        include: {
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              price: true,
              unit: true,
            },
          },
          payment: {
            select: {
              method: true,
              status: true,
              amount: true,
              gateway: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      let deliveredCount = 0
      let cancelledOrFailedCount = 0
      let totalPaid = 0
      let totalCod = 0

      for (const ord of sixMonthOrders) {
        if (ord.orderStatus === 'delivered') deliveredCount++
        if (ord.orderStatus === 'cancelled' || ord.paymentStatus === 'failed') cancelledOrFailedCount++
        if (ord.paymentStatus === 'paid') totalPaid += ord.totalAmount
        if (ord.paymentMethod === 'cod') totalCod += ord.totalAmount
      }

      sixMonthActivity = {
        since: sixMonthsAgo.toISOString(),
        totalOrders: sixMonthOrders.length,
        deliveredOrders: deliveredCount,
        cancelledOrders: cancelledOrFailedCount,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalCod: Math.round(totalCod * 100) / 100,
        orders: sixMonthOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          createdAt: o.createdAt,
          totalAmount: o.totalAmount,
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
          paymentMethod: o.paymentMethod,
          itemCount: o.items.reduce((s, it) => s + it.quantity, 0),
          items: o.items.map((it) => ({
            name: it.productName,
            quantity: it.quantity,
            price: it.price,
            unit: it.unit,
          })),
        })),
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...userWithoutPassword,
        hasPassword,
        identityStatus,
        sixMonthActivity,
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
    if (phone !== undefined) {
      data.phone = phone
      // A changed number must be verified again before it can be trusted.
      if (!isAdmin(role) || requestUserId === id) data.isVerified = false
    }
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
      data.sessionVersion = { increment: 1 }
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
    const requestUserId = await getUserIdFromRequest(request)
    const { id } = await params

    // Allow user to delete their own account, or admin to delete an account
    if (!isAdmin(role) && requestUserId !== id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Protect last remaining admin from accidental deletion
    const targetUser = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (targetUser.role === 'admin') {
      const adminCount = await db.user.count({ where: { role: 'admin', isActive: true } })
      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, error: 'Cannot delete the only remaining active administrator' },
          { status: 400 }
        )
      }
    }

    // Preservation of order & financial records under data retention policy:
    // If the user has orders, unlink them (userId = null) so the financial/order records are preserved.
    const userOrdersCount = await db.order.count({ where: { userId: id } })
    if (userOrdersCount > 0) {
      await db.order.updateMany({
        where: { userId: id },
        data: { userId: null },
      })
    }

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
