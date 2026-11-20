import { db } from '@/lib/db'
import { appendPaymentLog, isSuccessfulSSLCommerzStatus } from '@/lib/sslcommerz'

export async function recordPaymentEvent(
  params: {
    orderId: string
    event: string
    status: string
    transactionId?: string | null
    amount?: number | null
    payload?: Record<string, unknown>
    validation?: Record<string, unknown> | null
    message?: string
    dbClient?: any
  },
  dbClientArg?: any
) {
  const client = params.dbClient || dbClientArg || db
  const existing = await client.payment.findUnique({ where: { orderId: params.orderId } })
  const existingTransaction = params.transactionId
    ? await client.payment.findFirst({
        where: {
          transactionId: params.transactionId,
          orderId: { not: params.orderId },
        },
      })
    : null

  if (existingTransaction) {
    throw new Error('Duplicate transaction id detected')
  }

  const validationStatus = typeof params.validation?.status === 'string' ? params.validation.status : null
  const log = appendPaymentLog(existing?.gatewayResponse, {
    event: params.event,
    status: params.status,
    transactionId: params.transactionId || existing?.transactionId || null,
    validationStatus,
    message: params.message,
    payload: {
      ...(params.payload || {}),
      validation: params.validation || undefined,
    },
  })

  const paid = isSuccessfulSSLCommerzStatus(params.status) && isSuccessfulSSLCommerzStatus(validationStatus || params.status)
  const paymentStatus = paid ? 'paid' : params.status.toLowerCase()
  const paidAt = paid ? new Date() : existing?.paidAt || null

  const payment = await client.payment.upsert({
    where: { orderId: params.orderId },
    update: {
      method: 'online',
      gateway: 'sslcommerz',
      transactionId: params.transactionId || existing?.transactionId || null,
      status: paymentStatus,
      amount: params.amount ?? existing?.amount ?? 0,
      gatewayResponse: log,
      paidAt,
    },
    create: {
      orderId: params.orderId,
      method: 'online',
      gateway: 'sslcommerz',
      transactionId: params.transactionId || null,
      status: paymentStatus,
      amount: params.amount ?? 0,
      gatewayResponse: log,
      paidAt,
    },
  })

  const orderPaymentStatus = paid
    ? 'paid'
    : params.status.toLowerCase() === 'cancelled'
      ? 'cancelled'
      : params.status.toLowerCase() === 'failed'
        ? 'failed'
        : 'pending'

  const currentOrder = await client.order.findUnique({
    where: { id: params.orderId },
    select: { paymentStatus: true, orderStatus: true },
  })

  // Idempotency: If the order was already confirmed paid by authoritative IPN,
  // do not allow browser redirects or non-authoritative events to overwrite it.
  if (currentOrder?.paymentStatus === 'paid' && !paid) {
    return payment
  }

  const orderStatus = paid ? 'confirmed' : undefined
  await client.order.update({
    where: { id: params.orderId },
    data: {
      paymentStatus: orderPaymentStatus,
      ...(orderStatus ? { orderStatus } : {}),
      ...(payment.method ? { paymentMethod: payment.method } : {}),
    },
  })

  await client.deliveryLabel.updateMany({
    where: { orderId: params.orderId },
    data: { paymentStatus: orderPaymentStatus },
  })

  return payment
}
