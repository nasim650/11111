import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, isAdmin } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }
  try {
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

    const [
      totalProducts,
      totalOrders,
      totalUsers,
      totalRevenueResult,
      pendingOrders,
      recentOrders,
      totalCategories,
      totalReviews,
      completedOrders,
      newsletterSubscribers,
      lowStockProductsCount,
      // Current month revenue & orders
      currentMonthRevenueResult,
      currentMonthOrdersCount,
      // Last month revenue & orders
      lastMonthRevenueResult,
      lastMonthOrdersCount,
      // New customers this month
      customerGrowth,
      // Average order value
      avgOrderValueResult,
    ] = await Promise.all([
      db.product.count({ where: { status: 'active' } }),
      db.order.count(),
      db.user.count({ where: { isActive: true } }),
      db.order.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: 'paid' } }),
      db.order.count({ where: { orderStatus: 'pending' } }),
      db.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { select: { productName: true, quantity: true } },
          user: { select: { name: true, email: true } },
        },
      }),
      db.category.count({ where: { isActive: true } }),
      db.review.count({ where: { isApproved: true } }),
      db.order.count({ where: { orderStatus: 'delivered' } }),
      db.newsletterSubscriber.count({ where: { isActive: true } }),
      db.product.count({ where: { stock: { lt: 10 }, status: 'active' } }),
      // Current month revenue
      db.order.aggregate({
        _sum: { totalAmount: true },
        where: { paymentStatus: 'paid', createdAt: { gte: currentMonthStart } },
      }),
      // Current month orders count
      db.order.count({
        where: { createdAt: { gte: currentMonthStart } },
      }),
      // Last month revenue
      db.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          paymentStatus: 'paid',
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),
      // Last month orders count
      db.order.count({
        where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      // New customers this month
      db.user.count({
        where: {
          role: 'customer',
          createdAt: { gte: currentMonthStart },
        },
      }),
      // Average order value
      db.order.aggregate({
        _avg: { totalAmount: true },
        where: { paymentStatus: 'paid' },
      }),
    ])

    // Low stock products - always return as array of objects
    const lowStockProducts = await db.product.findMany({
      where: { stock: { lt: 10 }, status: 'active' },
      select: {
        id: true,
        name: true,
        stock: true,
        price: true,
        discountPrice: true,
        images: { where: { isFeatured: true }, take: 1, select: { url: true } },
        category: { select: { name: true } },
      },
      take: 10,
      orderBy: { stock: 'asc' },
    })

    // Top products by revenue (top 5)
    const topProductsRaw = await db.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    })

    // Fetch product details for top products
    const topProductIds = topProductsRaw.map((p) => p.productId)
    const topProductDetails = await db.product.findMany({
      where: { id: { in: topProductIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        discountPrice: true,
        images: { where: { isFeatured: true }, take: 1, select: { url: true } },
        category: { select: { name: true } },
      },
    })

    const topProducts = topProductsRaw.map((item) => {
      const details = topProductDetails.find((p) => p.id === item.productId)
      return {
        id: item.productId,
        name: details?.name || 'Unknown Product',
        slug: details?.slug || '',
        price: details?.price || 0,
        discountPrice: details?.discountPrice || null,
        image: details?.images[0]?.url || null,
        category: details?.category?.name || null,
        totalSold: item._sum.quantity || 0,
        totalOrders: item._count.id || 0,
        revenue: (details?.price || 0) * (item._sum.quantity || 0),
      }
    })

    // Calculate percentage changes
    const currentMonthRevenue = currentMonthRevenueResult._sum.totalAmount || 0
    const lastMonthRevenue = lastMonthRevenueResult._sum.totalAmount || 0
    const revenueChange = lastMonthRevenue > 0
      ? Number((((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1))
      : currentMonthRevenue > 0 ? 100 : 0

    const ordersChange = lastMonthOrdersCount > 0
      ? Number(((((currentMonthOrdersCount - lastMonthOrdersCount) / lastMonthOrdersCount) * 100)).toFixed(1))
      : currentMonthOrdersCount > 0 ? 100 : 0

    // Order status breakdown
    const orderStatusBreakdown = await db.order.groupBy({
      by: ['orderStatus'],
      _count: { id: true },
    })

    // Monthly revenue (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyOrders = await db.order.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo },
        paymentStatus: 'paid',
      },
      select: { totalAmount: true, createdAt: true },
    })

    const monthlyRevenue: Record<string, number> = {}
    for (const order of monthlyOrders) {
      const key = order.createdAt.toISOString().slice(0, 7) // YYYY-MM
      monthlyRevenue[key] = (monthlyRevenue[key] || 0) + order.totalAmount
    }

    // Print Queue stats
    const [
      printQueuePending,
      printQueuePrinting,
      printQueuePrinted,
      printQueueFailed,
      recentPrintQueueItems,
    ] = await Promise.all([
      db.printQueue.count({ where: { status: 'PENDING' } }),
      db.printQueue.count({ where: { status: 'PRINTING' } }),
      db.printQueue.count({ where: { status: 'PRINTED' } }),
      db.printQueue.count({ where: { status: 'FAILED' } }),
      db.printQueue.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              guestName: true,
            },
          },
        },
      }),
    ])

    // Loyalty Points stats
    const [totalLoyaltyIssued, totalLoyaltyRedeemed, totalLoyaltyBalance] = await Promise.all([
      db.loyaltyPoint.aggregate({
        where: { points: { gt: 0 } },
        _sum: { points: true },
      }),
      db.loyaltyPoint.aggregate({
        where: { points: { lt: 0 } },
        _sum: { points: true },
      }),
      db.user.aggregate({
        _sum: { loyaltyBalance: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        totalProducts: totalProducts || 0,
        totalOrders: totalOrders || 0,
        totalUsers: totalUsers || 0,
        totalRevenue: totalRevenueResult._sum.totalAmount || 0,
        pendingOrders: pendingOrders || 0,
        completedOrders: completedOrders || 0,
        totalCategories: totalCategories || 0,
        totalReviews: totalReviews || 0,
        newsletterSubscribers: newsletterSubscribers || 0,
        lowStockProducts: Array.isArray(lowStockProducts) ? lowStockProducts : [],
        lowStockProductsCount: lowStockProductsCount || 0,
        orderStatusBreakdown: orderStatusBreakdown.map((item) => ({
          status: item.orderStatus,
          count: item._count.id,
        })),
        monthlyRevenue,
        recentOrders,
        // New fields
        revenueChange,
        ordersChange,
        topProducts,
        customerGrowth: customerGrowth || 0,
        averageOrderValue: Number((avgOrderValueResult._avg.totalAmount || 0).toFixed(2)),
        currentMonthRevenue: currentMonthRevenue || 0,
        lastMonthRevenue: lastMonthRevenue || 0,
        currentMonthOrders: currentMonthOrdersCount || 0,
        lastMonthOrders: lastMonthOrdersCount || 0,
        // Print Queue stats
        printQueue: {
          pending: printQueuePending,
          printing: printQueuePrinting,
          printed: printQueuePrinted,
          failed: printQueueFailed,
          total: printQueuePending + printQueuePrinting + printQueuePrinted + printQueueFailed,
          recentItems: recentPrintQueueItems.map((item) => ({
            id: item.id,
            documentType: item.documentType,
            status: item.status,
            createdAt: item.createdAt,
            orderNumber: item.order.orderNumber,
            customerName: item.order.guestName || 'N/A',
          })),
        },
        // Loyalty Points stats
        loyaltyPoints: {
          totalIssued: totalLoyaltyIssued._sum.points || 0,
          totalRedeemed: Math.abs(totalLoyaltyRedeemed._sum.points || 0),
          totalBalance: totalLoyaltyBalance._sum.loyaltyBalance || 0,
        },
      },
    })
  } catch (error) {
    console.error('Get dashboard stats error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
