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

type CallbackKind = 'success' | 'fail' | 'cancel' | 'ipn'

function redirectFor(request: NextRequest, orderId: string, status: string) {
  const baseUrl = getAppBaseUrl(request)
  const url = new URL('/', baseUrl)
  url.searchParams.set('payment', status)
  url.searchParams.set('orderId', orderId)
  return NextResponse.redirect(url)
}

function statusFor(kind: CallbackKind, payloadStatus: string | undefined) {
  if (kind === 'fail') return 'FAILED'
  if (kind === 'cancel') return 'CANCELLED'
  return payloadStatus || 'PENDING'
}

export async function handleSSLCommerzCallback(request: NextRequest, kind: CallbackKind) {
  try {
    const config = await getSSLCommerzConfig()
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'SSLCOMMERZ credentials are not configured' },
        { status: 503 }
      )
    }

    const payload = await parseSSLCommerzPayload(request)
    const orderId = payload.value_a
    const transactionId = payload.tran_id
    const valId = payload.val_id
    const reportedStatus = statusFor(kind, payload.status)

    if (!orderId || !transactionId) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment callback payload' },
        { status: 400 }
      )
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { payment: true, items: true },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // ── 1. TRANSACTION INTEGRITY CHECKS ────────────────────────────────────────
    if (order.payment?.transactionId && order.payment.transactionId !== transactionId) {
      await recordPaymentEvent({
        orderId,
        event: `${kind}_transaction_mismatch`,
        status: 'FAILED',
        transactionId,
        amount: Number(payload.amount || order.totalAmount),
        payload,
        message: `Expected ${order.payment.transactionId}, received ${transactionId}`,
      })

      // If IPN reports mismatch, release inventory authoritatively
      if (kind === 'ipn') {
        await releaseOrderInventoryAndCoupon({
          orderId,
          reason: `Transaction mismatch: expected ${order.payment.transactionId}, got ${transactionId}`,
          paymentStatus: 'failed',
          orderStatus: 'cancelled',
        })
        return NextResponse.json({ success: false, error: 'Transaction mismatch' }, { status: 409 })
      }

      return redirectFor(request, orderId, 'failed')
    }

    const duplicate = await db.payment.findFirst({
      where: {
        transactionId,
        orderId: { not: orderId },
      },
    })
    if (duplicate) {
      return kind === 'ipn'
        ? NextResponse.json({ success: false, error: 'Duplicate transaction id' }, { status: 409 })
        : redirectFor(request, orderId, 'failed')
    }

    // ── 2. NON-AUTHORITATIVE BROWSER REDIRECTS (success, fail, cancel) ─────────
    // Per Payment Hardening Policy:
    // Browser redirects are strictly non-authoritative. They CANNOT mutate order status,
    // cannot mutate stock, cannot mutate coupon, and cannot change payment status.
    // They only log a non-authoritative diagnostic entry and navigate the client browser.
    if (kind !== 'ipn') {
      const browserEventName = `browser_${kind}_redirect`

      await recordPaymentEvent({
        orderId,
        event: browserEventName,
        status: order.paymentStatus.toUpperCase(),
        transactionId,
        amount: Number(payload.amount || order.totalAmount),
        payload,
        message: `Non-authoritative browser ${kind} redirect received from client`,
      })

      await createAuditLog({
        action: `payment_${browserEventName}`,
        module: 'payments',
        referenceId: orderId,
        newData: {
          orderId,
          transactionId,
          browserKind: kind,
          authoritativePaymentStatus: order.paymentStatus,
          authoritativeOrderStatus: order.orderStatus,
        },
      })

      const targetRedirectParam = kind === 'success' ? 'success' : 'fail'
      return redirectFor(request, orderId, targetRedirectParam)
    }

    // ── 3. SOLE AUTHORITATIVE CONTROLLER: SERVER-TO-SERVER IPN ─────────────────
    // Only properly validated SSLCOMMERZ server-side IPN can mutate payment,
    // order, inventory, and coupon state transitions.
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
      // Valid authoritative payment: finalize order and lock reserved stock
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
