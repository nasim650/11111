import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import type { Prisma } from '@prisma/client'

export const ORDER_RESERVATION_TTL_MS = 30 * 60 * 1000 // 30 minutes

type DbClient = Prisma.TransactionClient | typeof db

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
 * Releases reserved inventory and coupon usage for an order in a single atomic transaction.
 * Idempotent: If stock is already released (stockReserved === false) or order is already paid,
 * this function exits cleanly without double-restoring stock or double-releasing coupons.
 */
export async function releaseOrderInventoryAndCoupon(params: {
  orderId: string
  reason: string
  paymentStatus?: string
  orderStatus?: string
  tx?: DbClient
}): Promise<ReleaseInventoryResult> {
  const { orderId, reason, paymentStatus = 'failed', orderStatus = 'cancelled', tx } = params

  const runWithTx = async (client: DbClient): Promise<ReleaseInventoryResult> => {
    // Lock / fetch order with items
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
        reason: 'Order not found',
      }
    }

    // Idempotency check:
    // If stock is already released or order is already marked paid, DO NOT restore again
    if (!order.stockReserved || order.paymentStatus === 'paid') {
      return {
        success: true,
        alreadyReleased: true,
        restoredStock: 0,
        restoredCoupon: false,
        orderId,
        reason: order.paymentStatus === 'paid' ? 'Order is already paid' : 'Stock already released',
      }
    }

    let totalRestored = 0

    // 1. Restore product stock atomically
    for (const item of order.items) {
      await client.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      })
      totalRestored += item.quantity
    }

    // 2. Release coupon reservation if applicable
    let couponRestored = false
    if (order.couponCode && !order.couponReleased) {
      await client.coupon.updateMany({
        where: { code: order.couponCode, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      })
      couponRestored = true
    }

    // 3. Update order state atomically
    await client.order.update({
      where: { id: orderId },
      data: {
        stockReserved: false,
        couponReleased: order.couponCode ? true : false,
        orderStatus,
        paymentStatus,
        reservationExpiresAt: null, // Clear timer
      },
    })

    // 4. Record order status history
    await client.orderStatusHistory.create({
      data: {
        orderId,
        status: orderStatus,
        note: `Inventory released: ${reason}`,
      },
    })

    // 5. Record audit log
    await createAuditLog({
      action: 'inventory_release',
      module: 'orders',
      referenceId: orderId,
      newData: {
        orderId,
        restoredStock: totalRestored,
        restoredCoupon: couponRestored,
        reason,
        orderStatus,
        paymentStatus,
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

  return db.$transaction(async (client) => {
    return runWithTx(client)
  })
}

/**
 * Finalizes order payment upon valid authoritative IPN payment confirmation.
 * Transitions order to 'paid' and 'confirmed', and clears reservation expiry.
 * If order was already cancelled or expired and stock released, returns error.
 */
export async function finalizeOrderPayment(params: {
  orderId: string
  transactionId?: string | null
  gatewayResponse?: string | null
  paidAt?: Date | null
  tx?: DbClient
}): Promise<FinalizePaymentResult> {
  const { orderId, transactionId, gatewayResponse, paidAt = new Date(), tx } = params

  const runWithTx = async (client: DbClient): Promise<FinalizePaymentResult> => {
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    })

    if (!order) {
      return { success: false, alreadyPaid: false, orderId, error: 'Order not found' }
    }

    // If order was already expired or cancelled and stock was released, it cannot be paid
    if (!order.stockReserved || order.orderStatus === 'cancelled') {
      return {
        success: false,
        alreadyPaid: false,
        orderId,
        error: 'Order was expired/cancelled and reserved inventory was already released',
      }
    }

    // Idempotency: if already paid, return cleanly without duplicate history
    if (order.paymentStatus === 'paid') {
      return { success: true, alreadyPaid: true, orderId }
    }

    // Update payment record
    await client.payment.upsert({
      where: { orderId },
      update: {
        status: 'paid',
        transactionId: transactionId || order.payment?.transactionId,
        gatewayResponse: gatewayResponse || order.payment?.gatewayResponse,
        paidAt,
      },
      create: {
        orderId,
        method: 'online',
        gateway: 'sslcommerz',
        status: 'paid',
        amount: order.totalAmount,
        transactionId,
        gatewayResponse,
        paidAt,
      },
    })

    // Update order record
    await client.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
        reservationExpiresAt: null, // Finalized, no longer subject to reservation expiry
      },
    })

    // Record order status history
    await client.orderStatusHistory.create({
      data: {
        orderId,
        status: 'confirmed',
        note: 'Payment validated via authoritative IPN callback',
      },
    })

    // Update delivery label payment status
    await client.deliveryLabel.updateMany({
      where: { orderId },
      data: { paymentStatus: 'paid' },
    })

    // Record audit log
    await createAuditLog({
      action: 'payment_success_ipn',
      module: 'payments',
      referenceId: orderId,
      newData: {
        orderId,
        transactionId,
        status: 'paid',
      },
    })

    return { success: true, alreadyPaid: false, orderId }
  }

  if (tx) {
    return runWithTx(tx)
  }

  return db.$transaction(async (client) => {
    return runWithTx(client)
  })
}

/**
 * Sweeps all pending online orders whose reservation has expired (30+ minutes)
 * and safely releases reserved inventory and coupons in atomic transactions.
 */
export async function expirePendingOrders(cutoffDate: Date = new Date()): Promise<{
  expiredCount: number
  processedOrderIds: string[]
}> {
  const expiredOrders = await db.order.findMany({
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
