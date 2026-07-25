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
} from '@/lib/sslcommerz'
import { recordPaymentEvent } from '@/lib/payment-sync'

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
      include: { payment: true },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

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

    if (kind === 'success' || kind === 'ipn') {
      if (!signatureValid || !validation || !statusValid || !amountMatches) {
        await recordPaymentEvent({
          orderId,
          event: `${kind}_verification_failed`,
          status: 'FAILED',
          transactionId,
          amount: reportedAmount || order.totalAmount,
          payload,
          validation,
          message: `signature=${signatureValid}; statusValid=${statusValid}; amountMatches=${amountMatches}`,
        })

        return kind === 'ipn'
          ? NextResponse.json({ success: false, error: 'Payment verification failed' }, { status: 400 })
          : redirectFor(request, orderId, 'failed')
      }
    }

    const finalStatus = kind === 'fail' ? 'FAILED' : kind === 'cancel' ? 'CANCELLED' : reportedStatus
    const payment = await recordPaymentEvent({
      orderId,
      event: kind,
      status: finalStatus,
      transactionId,
      amount: reportedAmount || order.totalAmount,
      payload,
      validation,
    })

    await createAuditLog({
      action: `payment_${kind}`,
      module: 'payments',
      referenceId: payment.id,
      newData: {
        orderId,
        transactionId,
        status: finalStatus,
        validationStatus,
        signatureValid,
      },
    })

    if (kind === 'ipn') {
      return NextResponse.json({ success: true, data: { orderId, transactionId, status: payment.status } })
    }

    return redirectFor(request, orderId, payment.status === 'paid' ? 'success' : payment.status)
  } catch (error) {
    console.error(`SSLCOMMERZ ${kind} callback error:`, error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
