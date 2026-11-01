import { db } from '@/lib/db'

export interface SafeOrderItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unit: string
  price: number
  image: string | null
  slug: string | null
}

export interface SafeOrderDetails {
  id: string
  orderNumber: string
  totalAmount: number
  discountAmount: number
  deliveryCharge: number
  paymentMethod: string
  paymentStatus: string
  orderStatus: string
  orderNote: string | null
  couponCode: string | null
  createdAt: string
  updatedAt: string
  guestName: string | null
  guestPhone: string | null
  guestEmail: string | null
  guestAddress: string | null
  items: SafeOrderItem[]
  payment: {
    method: string
    status: string
    transactionId: string | null
    paidAt: string | null
  } | null
  user: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  } | null
}

export type OrderAuthResult =
  | { status: 200; order: SafeOrderDetails; error: null }
  | { status: 401; order: null; error: string }
  | { status: 403; order: null; error: string }
  | { status: 404; order: null; error: string }

/**
 * Server-side authorization check and safe data serializer for an order.
 * - Logged-in customer can ONLY see their own order.
 * - Admin or manager role can see any order.
 * - Unauthenticated user cannot see order details (401).
 * - Customer A cannot see Customer B's order (403).
 * - Nonexistent order returns 404.
 * - Raw secrets, session keys, gateway payloads, and audit logs are strictly excluded.
 */
export async function getOrderForUser(
  orderNumber: string,
  user: { userId: string; role: string } | null,
  prismaClient?: any
): Promise<OrderAuthResult> {
  const prisma = prismaClient || db

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: {
                where: { isFeatured: true },
                take: 1,
                select: { url: true, alt: true },
              },
            },
          },
        },
      },
      payment: {
        select: {
          method: true,
          status: true,
          transactionId: true,
          paidAt: true,
          // Explicitly do not select rawResponse or internal secrets
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  })

  if (!order) {
    return {
      status: 404,
      error: `Order #${orderNumber} not found`,
      order: null,
    }
  }

  // Mandatory Server-side Authorization Check
  if (!user) {
    return {
      status: 401,
      error: 'Authentication required. Please sign in to view this order.',
      order: null,
    }
  }

  const isUserAdmin = user.role === 'admin' || user.role === 'manager'
  const isOwner = Boolean(order.userId && order.userId === user.userId)

  if (!isUserAdmin && !isOwner) {
    return {
      status: 403,
      error: 'Forbidden: You do not have permission to view this order.',
      order: null,
    }
  }

  // Sanitize items
  const safeItems: SafeOrderItem[] = (order.items || []).map((item: any) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unit: item.unit || 'piece',
    price: item.price,
    image: item.product?.images?.[0]?.url || item.image || null,
    slug: item.product?.slug || null,
  }))

  const safeOrder: SafeOrderDetails = {
    id: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    discountAmount: order.discountAmount || 0,
    deliveryCharge: order.deliveryCharge || 0,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    orderNote: order.orderNote || null,
    couponCode: order.couponCode || null,
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt),
    updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : String(order.updatedAt),
    guestName: order.guestName || null,
    guestPhone: order.guestPhone || null,
    guestEmail: order.guestEmail || null,
    guestAddress: order.guestAddress || null,
    items: safeItems,
    payment: order.payment
      ? {
          method: order.payment.method,
          status: order.payment.status,
          transactionId: order.payment.transactionId || null,
          paidAt: order.payment.paidAt
            ? (order.payment.paidAt instanceof Date ? order.payment.paidAt.toISOString() : String(order.payment.paidAt))
            : null,
        }
      : null,
    user: order.user
      ? {
          id: order.user.id,
          name: order.user.name || null,
          email: order.user.email || null,
          phone: order.user.phone || null,
        }
      : null,
  }

  return {
    status: 200,
    error: null,
    order: safeOrder,
  }
}
