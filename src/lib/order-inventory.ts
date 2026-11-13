import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export const ORDER_RESERVATION_TTL_MS = 30 * 60 * 1000 // 30 minutes

export type DbClient = Prisma.TransactionClient | typeof db | any

export interface ReleaseInventoryResult {
  success: boolean
  alreadyReleased: boolean
  restoredStock: number
  restoredCoupon: boolean
  orderId: string
  reason?: string
}

export interface FinalizePaymentResult {
  success: boolean
  alreadyPaid: boolean
  orderId: string
  error?: string
}

/**
 * Calculates reservation expiry for an order based on payment method.
 * Online orders receive a 30-minute reservation window.
 * Cash on Delivery (COD) orders do not expire via online reservation timer.
 */
export function getReservationExpiry(paymentMethod: string): Date | null {
  if (paymentMethod === 'online') {
    return new Date(Date.now() + ORDER_RESERVATION_TTL_MS)
  }
  return null
}

/**
 * Releases reserved inventory and coupon usage for an order in a single atomic transaction
 * with atomic conditional state claim.
 *
 * Idempotency & Concurrency:
 * Uses an atomic UPDATE with conditional WHERE clause:
 *   UPDATE "Order" SET "stockReserved" = false WHERE "id" = orderId AND "stockReserved" = true AND "paymentStatus" != 'paid'
 * In PostgreSQL, this locks the matched row. Concurrent requests wait on the lock;
 * once the first commits, subsequent requests find count = 0 and exit as safe no-ops.
 *
 * Transaction Boundary:
 * All mutations (order update, stock increment, coupon decrement, status history, and audit log)
 * occur within the exact same transaction client. If any step fails, the entire transaction rolls back.
 */
export async function releaseOrderInventoryAndCoupon(params: {
  orderId: string
  reason: string
  paymentStatus?: string
  orderStatus?: string
  tx?: DbClient
  dbClient?: any
}): Promise<ReleaseInventoryResult> {
  const { orderId, reason, paymentStatus = 'failed', orderStatus = 'cancelled', tx, dbClient = db } = params

  const runWithTx = async (client: DbClient): Promise<ReleaseInventoryResult> => {
    // ── 1. ATOMIC CONDITIONAL STATE CLAIM ──
    const claim = await client.order.updateMany({
      where: {
        id: orderId,
        stockReserved: true,
        paymentStatus: { not: 'paid' },
      },
      data: {
        stockReserved: false,
        reservationExpiresAt: null,
      },
    })

    if (claim.count === 0) {
      // Order was already claimed/released, or is already confirmed paid
      const existing = await client.order.findUnique({
        where: { id: orderId },
        select: { paymentStatus: true, stockReserved: true },
      })
      return {
        success: true,
        alreadyReleased: true,
        restoredStock: 0,
        restoredCoupon: false,
        orderId,
        reason: existing?.paymentStatus === 'paid'
          ? 'Order is already paid; stock cannot be restored'
          : 'Stock was already released or claimed by another transaction',
      }
    }

    // This transaction now exclusively holds the claim to release inventory & coupon
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })

    if (!order) {
      return {
        success: false,
        alreadyReleased: true,
        restoredStock: 0,
        restoredCoupon: false,
        orderId,
        reason: 'Order not found after claim',
      }
    }

    let totalRestored = 0

    // ── 2. RESTORE PRODUCT STOCK ATOMICALLY ──
    for (const item of order.items) {
      await client.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      })
      totalRestored += item.quantity
    }

    // ── 3. RELEASE COUPON RESERVATION ATOMICALLY ──
    let couponRestored = false
    if (order.couponCode && !order.couponReleased) {
      const couponClaim = await client.order.updateMany({
        where: { id: orderId, couponReleased: false },
        data: { couponReleased: true },
      })
      if (couponClaim.count > 0) {
        await client.coupon.updateMany({
          where: { code: order.couponCode, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        })
        couponRestored = true
      }
    }

    // ── 4. FINALIZE ORDER STATUS ──
    await client.order.update({
      where: { id: orderId },
      data: {
        orderStatus,
        paymentStatus,
      },
    })

    // ── 5. RECORD ORDER STATUS HISTORY ──
    await client.orderStatusHistory.create({
      data: {
        orderId,
        status: orderStatus,
        note: `Inventory released: ${reason}`,
      },
    })

    // ── 6. RECORD AUDIT LOG INSIDE SAME TRANSACTION BOUNDARY ──
    await client.auditLog.create({
      data: {
        action: 'inventory_release',
        module: 'orders',
        referenceId: orderId,
        newData: JSON.stringify({
          orderId,
          restoredStock: totalRestored,
          restoredCoupon: couponRestored,
          reason,
          orderStatus,
          paymentStatus,
        }),
      },
    })

    return {
      success: true,
      alreadyReleased: false,
      restoredStock: totalRestored,
      restoredCoupon: couponRestored,
      orderId,
    }
  }

  if (tx) {
    return runWithTx(tx)
  }

  return dbClient.$transaction(async (client: DbClient) => {
    return runWithTx(client)
  })
}

/**
 * Finalizes order payment upon valid authoritative server-to-server IPN confirmation.
 * Uses atomic conditional state claim:
 *   UPDATE "Order" SET "paymentStatus" = 'paid', "orderStatus" = 'confirmed'
 *   WHERE "id" = orderId AND "stockReserved" = true AND "paymentStatus" != 'paid' AND "orderStatus" != 'cancelled'
 *
 * Idempotency:
 * If already paid, returns { success: true, alreadyPaid: true } without duplicate mutations.
 * If already cancelled or expired and stock released, returns error and blocks payment finalization.
 */
export async function finalizeOrderPayment(params: {
  orderId: string
  transactionId?: string | null
  gatewayResponse?: string | null
  paidAt?: Date | null
  tx?: DbClient
  dbClient?: any
}): Promise<FinalizePaymentResult> {
  const { orderId, transactionId, gatewayResponse, paidAt = new Date(), tx, dbClient = db } = params

  const runWithTx = async (client: DbClient): Promise<FinalizePaymentResult> => {
    // ── 1. ATOMIC CONDITIONAL CLAIM ──
    const claim = await client.order.updateMany({
      where: {
        id: orderId,
        stockReserved: true,
        paymentStatus: { not: 'paid' },
        orderStatus: { not: 'cancelled' },
      },
      data: {
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
        reservationExpiresAt: null, // Clear timer, stock is permanently committed
      },
    })

    if (claim.count === 0) {
      const existing = await client.order.findUnique({
        where: { id: orderId },
        select: { paymentStatus: true, stockReserved: true, orderStatus: true },
      })

      if (existing?.paymentStatus === 'paid') {
        // Idempotent duplicate: already successfully paid
        return { success: true, alreadyPaid: true, orderId }
      }

      return {
        success: false,
        alreadyPaid: false,
        orderId,
        error: `Order cannot be paid: status is ${existing?.orderStatus}, stockReserved=${existing?.stockReserved}, paymentStatus=${existing?.paymentStatus}`,
      }
    }

    // This transaction exclusively claimed payment finalization
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    })

    // ── 2. RECORD / UPDATE PAYMENT RECORD ──
    await client.payment.upsert({
      where: { orderId },
      update: {
        status: 'paid',
        transactionId: transactionId || order?.payment?.transactionId,
        gatewayResponse: gatewayResponse || order?.payment?.gatewayResponse,
        paidAt,
      },
      create: {
        orderId,
        method: 'online',
        gateway: 'sslcommerz',
        status: 'paid',
        amount: order?.totalAmount ?? 0,
        transactionId,
        gatewayResponse,
        paidAt,
      },
    })

    // ── 3. RECORD STATUS HISTORY ──
    await client.orderStatusHistory.create({
      data: {
        orderId,
        status: 'confirmed',
        note: 'Payment validated via authoritative IPN callback',
      },
    })

    // ── 4. UPDATE DELIVERY LABEL ──
    await client.deliveryLabel.updateMany({
      where: { orderId },
      data: { paymentStatus: 'paid' },
    })

    // ── 5. RECORD AUDIT LOG INSIDE SAME TRANSACTION BOUNDARY ──
    await client.auditLog.create({
      data: {
        action: 'payment_success_ipn',
        module: 'payments',
        referenceId: orderId,
        newData: JSON.stringify({
          orderId,
          transactionId,
          status: 'paid',
        }),
      },
    })

    return { success: true, alreadyPaid: false, orderId }
  }

  if (tx) {
    return runWithTx(tx)
  }

  return dbClient.$transaction(async (client: DbClient) => {
    return runWithTx(client)
  })
}

/**
 * Sweeps all pending online orders whose reservation has expired (30+ minutes)
 * and safely releases reserved inventory and coupons in atomic transactions.
 */
export async function expirePendingOrders(params?: {
  cutoffDate?: Date
  dbClient?: any
}): Promise<{
  expiredCount: number
  processedOrderIds: string[]
}> {
  const cutoffDate = params?.cutoffDate || new Date()
  const dbInstance = params?.dbClient || db

  const expiredOrders = await dbInstance.order.findMany({
    where: {
      paymentMethod: 'online',
      paymentStatus: 'pending',
      stockReserved: true,
      reservationExpiresAt: { lte: cutoffDate },
    },
    select: { id: true, orderNumber: true },
    take: 100, // Batch limit for safe transaction processing
  })

  const processedOrderIds: string[] = []

  for (const ord of expiredOrders) {
    const result = await releaseOrderInventoryAndCoupon({
      orderId: ord.id,
      reason: 'Online checkout reservation expired after 30 minutes',
      paymentStatus: 'expired',
      orderStatus: 'cancelled',
      dbClient: dbInstance,
    })
    if (result.success && !result.alreadyReleased) {
      processedOrderIds.push(ord.id)
    }
  }

  return {
    expiredCount: processedOrderIds.length,
    processedOrderIds,
  }
}
