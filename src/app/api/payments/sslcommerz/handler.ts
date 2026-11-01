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
      await releaseOrderInventoryAndCoupon({
        orderId,
        reason: `Transaction mismatch: expected ${order.payment.transactionId}, got ${transactionId}`,
        paymentStatus: 'failed',
        orderStatus: 'cancelled',
      })
      return kind === 'ipn'
        ? NextResponse.json({ success: false, error: 'Transaction mismatch' }, { status: 409 })
        : redirectFor(request, orderId, 'failed')
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

    // ── 2. FAIL OR CANCEL CALLBACKS (Browser or IPN) ───────────────────────────
    if (kind === 'fail' || kind === 'cancel') {
      const finalStatus = kind === 'cancel' ? 'cancelled' : 'failed'
      await releaseOrderInventoryAndCoupon({
        orderId,
        reason: `Payment ${kind}: reported status ${reportedStatus}`,
        paymentStatus: finalStatus,
        orderStatus: 'cancelled',
      })

      await recordPaymentEvent({
        orderId,
        event: kind,
        status: finalStatus.toUpperCase(),
        transactionId,
        amount: Number(payload.amount || order.totalAmount),
        payload,
      })

      return redirectFor(request, orderId, finalStatus)
    }

    // ── 3. AUTHORITATIVE IPN SUCCESS VALIDATION ────────────────────────────────
    if (kind === 'ipn') {
      const signatureValid = verifySSLCommerzSignature(payload, config.storePassword)
      let validation: Record<string, unknown> | null = null

      if (valId && signatureValid) {
        validation = await validateSSLCommerzTransaction(valId, config)
      }

      const validationStatus = typeof validation?.status === 'string' ? validation.status : null
      const reportedAmount = Number(payload.amount || payload.currency_amount || 0)
      const validatedAmount = Number(validation?.amount || validation?.currency_amount || reportedAmount)
      const amountMatches = Math.abs((validatedAmount || reportedAmount) - order.totalAmount) < 0.01
      const statusValid = isSuccessfulSSLCommerzStatus(reportedStatus) && isSuccessfulSSLCommerzStatus(validationStatus)

      if (!signatureValid || !validation || !statusValid || !amountMatches) {
        // Invalid or fraudulent IPN: release stock & mark failed
        await releaseOrderInventoryAndCoupon({
          orderId,
          reason: `IPN verification failed (sig=${signatureValid}, statusValid=${statusValid}, amountMatches=${amountMatches})`,
          paymentStatus: 'failed',
          orderStatus: 'cancelled',
        })

        await recordPaymentEvent({
          orderId,
          event: 'ipn_verification_failed',
          status: 'FAILED',
          transactionId,
          amount: reportedAmount || order.totalAmount,
          payload,
          validation,
          message: `signature=${signatureValid}; statusValid=${statusValid}; amountMatches=${amountMatches}`,
        })

        return NextResponse.json({ success: false, error: 'Payment verification failed' }, { status: 400 })
      }

      // Valid IPN: finalize order payment atomically
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

    // ── 4. NON-AUTHORITATIVE BROWSER SUCCESS REDIRECT ──────────────────────────
    // Browser redirect is not authoritative. We record the user's return event
    // without releasing stock or forcing unverified status, awaiting authoritative IPN.
    if (kind === 'success') {
      const isAlreadyPaid = order.paymentStatus === 'paid'

      await recordPaymentEvent({
        orderId,
        event: 'browser_success_redirect',
        status: isAlreadyPaid ? 'PAID' : 'PENDING_IPN_CONFIRMATION',
        transactionId,
        amount: Number(payload.amount || order.totalAmount),
        payload,
      })

      await createAuditLog({
        action: 'payment_browser_success_redirect',
        module: 'payments',
        referenceId: orderId,
        newData: {
          orderId,
          transactionId,
          orderPaymentStatus: order.paymentStatus,
          authoritativeIpnReceived: isAlreadyPaid,
        },
      })

      return redirectFor(request, orderId, 'success')
    }

    return redirectFor(request, orderId, 'failed')
  } catch (error) {
    console.error(`SSLCOMMERZ ${kind} callback error:`, error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
