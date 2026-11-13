import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import {
  getAppBaseUrl,
  getSSLCommerzConfig,
  isSuccessfulSSLCommerzStatus,
  parseSSLCommerzPayload,
  validateSSLCommerzTransaction,
  verifySSLCommerzSignature,
  appendPaymentLog,
} from '@/lib/sslcommerz'
import { recordPaymentEvent } from '@/lib/payment-sync'
import {
  releaseOrderInventoryAndCoupon,
  finalizeOrderPayment,
} from '@/lib/order-inventory'

export type CallbackKind = 'success' | 'fail' | 'cancel' | 'ipn'

function redirectFor(request: NextRequest, orderId: string, status: string) {
  const baseUrl = getAppBaseUrl(request)
  const url = new URL('/', baseUrl)
  url.searchParams.set('payment', status)
  if (orderId) {
    url.searchParams.set('orderId', orderId)
  }
  return NextResponse.redirect(url)
}

function statusFor(kind: CallbackKind, payloadStatus: string | undefined) {
  if (kind === 'fail') return 'FAILED'
  if (kind === 'cancel') return 'CANCELLED'
  return payloadStatus || 'PENDING'
}

export async function handleSSLCommerzCallback(
  request: NextRequest,
  kind: CallbackKind,
  customDb?: any
) {
  const prisma = customDb || db
  try {
    const config = await getSSLCommerzConfig(prisma)
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'SSLCOMMERZ credentials are not configured' },
        { status: 503 }
      )
    }

    const payload = await parseSSLCommerzPayload(request)
    const orderId = payload.value_a || ''
    const transactionId = payload.tran_id || ''

    // ── 1. BROWSER CALLBACKS (success, fail, cancel) ───────────────────────────
    // STRICT NON-AUTHORITATIVE POLICY (Phase 1B.1.1):
    // Browser callbacks are strictly non-authoritative and must NEVER mutate
    // order status, payment status, inventory stock, coupon counts, or payment logs.
    // They do NOT call recordPaymentEvent() (which mutates Order, Payment, and DeliveryLabel).
    // They do NOT perform transaction mismatch, duplicate check, or signature check.
    if (kind !== 'ipn') {
      if (orderId) {
        // Minimal append-only audit log.
        // Raw gateway payload, card numbers, and secrets are strictly excluded.
        await createAuditLog({
          action: `payment_browser_${kind}_redirect`,
          module: 'payments',
          referenceId: orderId,
          newData: {
            orderId,
            browserKind: kind,
          },
        }, prisma)
      }

      const targetStatus = kind === 'success' ? 'success' : kind === 'cancel' ? 'cancel' : 'fail'
      return redirectFor(request, orderId, targetStatus)
    }

    // ── 2. SOLE AUTHORITATIVE CONTROLLER: SERVER-TO-SERVER IPN ─────────────────
    // From this point onward, kind === 'ipn' ONLY.
    if (!orderId || !transactionId) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment callback payload' },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, items: true },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // IPN Transaction integrity check (mismatch)
    if (order.payment?.transactionId && order.payment.transactionId !== transactionId) {
      await releaseOrderInventoryAndCoupon({
        orderId,
        reason: `IPN transaction mismatch: expected ${order.payment.transactionId}, got ${transactionId}`,
        paymentStatus: 'failed',
        orderStatus: 'cancelled',
        dbClient: prisma,
      })

      await recordPaymentEvent({
        orderId,
        event: 'ipn_transaction_mismatch',
        status: 'FAILED',
        transactionId,
        amount: Number(payload.amount || order.totalAmount),
        payload,
        message: `Expected ${order.payment.transactionId}, received ${transactionId}`,
        dbClient: prisma,
      })

      return NextResponse.json({ success: false, error: 'Transaction mismatch' }, { status: 409 })
    }

    // IPN Duplicate transaction check
    const duplicate = await prisma.payment.findFirst({
      where: {
        transactionId,
        orderId: { not: orderId },
      },
    })
    if (duplicate) {
      return NextResponse.json({ success: false, error: 'Duplicate transaction id' }, { status: 409 })
    }

    const valId = payload.val_id
    const reportedStatus = statusFor(kind, payload.status)
    const signatureValid = verifySSLCommerzSignature(payload, config.storePassword)
    let validation: Record<string, unknown> | null = null

    if (valId && signatureValid) {
      validation = await validateSSLCommerzTransaction(valId, config)
    }

    const validationStatus = typeof validation?.status === 'string' ? validation.status : null
    const reportedAmount = Number(payload.amount || payload.currency_amount || 0)
    const validatedAmount = Number(validation?.amount || validation?.currency_amount || reportedAmount)
    const amountMatches = Math.abs((validatedAmount || reportedAmount) - order.totalAmount) < 0.01
    const isSuccessReported = isSuccessfulSSLCommerzStatus(reportedStatus)
    const isValidationSuccess = isSuccessfulSSLCommerzStatus(validationStatus)
    const paymentConfirmedValid = signatureValid && Boolean(validation) && isSuccessReported && isValidationSuccess && amountMatches

    if (paymentConfirmedValid) {
      // Authoritative validated payment: finalize order and lock reserved stock
      const finalLog = appendPaymentLog(order.payment?.gatewayResponse, {
        event: 'ipn_success_validated',
        status: 'paid',
        transactionId,
        validationStatus,
        payload,
      })

      const finalizeResult = await finalizeOrderPayment({
        orderId,
        transactionId,
        gatewayResponse: finalLog,
        paidAt: new Date(),
        dbClient: prisma,
      })

      if (!finalizeResult.success) {
        return NextResponse.json(
          { success: false, error: finalizeResult.error || 'Unable to finalize payment' },
          { status: 409 }
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          orderId,
          transactionId,
          status: 'paid',
          alreadyPaid: finalizeResult.alreadyPaid,
        },
      })
    }

    // Authoritative IPN reported failure, cancellation, or verification failure:
    // Atomic state claim & rollback of reserved inventory and coupon
    const failureReason = !signatureValid
      ? 'IPN signature verification failed'
      : !amountMatches
      ? `IPN amount mismatch (expected ${order.totalAmount}, got ${validatedAmount || reportedAmount})`
      : `IPN reported status: ${reportedStatus} (validation: ${validationStatus || 'none'})`

    const finalPaymentStatus = /cancel/i.test(reportedStatus) ? 'cancelled' : 'failed'

    const releaseResult = await releaseOrderInventoryAndCoupon({
      orderId,
      reason: `Authoritative IPN: ${failureReason}`,
      paymentStatus: finalPaymentStatus,
      orderStatus: 'cancelled',
      dbClient: prisma,
    })

    await recordPaymentEvent({
      orderId,
      event: 'ipn_failure_processed',
      status: finalPaymentStatus.toUpperCase(),
      transactionId,
      amount: reportedAmount || order.totalAmount,
      payload,
      validation,
      message: failureReason,
      dbClient: prisma,
    })

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        transactionId,
        status: finalPaymentStatus,
        inventoryReleased: !releaseResult.alreadyReleased,
      },
    })
  } catch (error) {
    console.error('SSLCOMMERZ callback error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
