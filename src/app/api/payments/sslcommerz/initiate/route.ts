import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { getUserFromRequest, isAdmin } from '@/lib/utils'
import { csrfGuard, rateLimitOrResponse } from '@/lib/security'
import { appendPaymentLog, createSSLCommerzSession, getSSLCommerzConfig } from '@/lib/sslcommerz'

export async function POST(request: NextRequest) {
  try {
    const csrf = csrfGuard(request)
    if (csrf) return csrf

    const limited = await rateLimitOrResponse(request, 'sslcommerz-initiate', 10, 60 * 1000)
    if (limited) return limited

    const body = await request.json()
    const orderId = typeof body.orderId === 'string' ? body.orderId : ''
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      )
    }

    const authUser = await getUserFromRequest(request)
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payment: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.userId && (!authUser || (!isAdmin(authUser.role) && authUser.userId !== order.userId))) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    if (order.paymentStatus === 'paid') {
      return NextResponse.json(
        { success: false, error: 'Order is already paid' },
        { status: 409 }
      )
    }

    const onlinePaymentSetting = await db.siteConfig.findUnique({
      where: { key: 'enableOnlinePayment' },
      select: { value: true },
    })
    if (onlinePaymentSetting?.value !== 'true') {
      return NextResponse.json(
        { success: false, error: 'Online payment is currently unavailable' },
        { status: 503 }
      )
    }

    const config = await getSSLCommerzConfig()
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'SSLCOMMERZ credentials are not configured' },
        { status: 503 }
      )
    }

    const transactionId = order.payment?.transactionId?.startsWith(`KK-${order.orderNumber}`)
      ? order.payment.transactionId
      : `KK-${order.orderNumber}-${Date.now()}`

    const response = await createSSLCommerzSession({
      request,
      config,
      order,
      transactionId,
    })

    const gatewayPageURL = response.GatewayPageURL || response.gatewayPageURL
    if (typeof gatewayPageURL !== 'string' || !gatewayPageURL.startsWith('https://')) {
      await db.payment.upsert({
        where: { orderId: order.id },
        update: {
          method: 'online',
          gateway: 'sslcommerz',
          transactionId,
          status: 'failed',
          gatewayResponse: appendPaymentLog(order.payment?.gatewayResponse, {
            event: 'initiate_failed',
            status: String(response.status || 'failed'),
            transactionId,
            payload: response,
          }),
        },
        create: {
          orderId: order.id,
          userId: order.userId,
          method: 'online',
          gateway: 'sslcommerz',
          transactionId,
          status: 'failed',
          amount: order.totalAmount,
          gatewayResponse: appendPaymentLog(null, {
            event: 'initiate_failed',
            status: String(response.status || 'failed'),
            transactionId,
            payload: response,
          }),
        },
      })

      return NextResponse.json(
        { success: false, error: 'SSLCOMMERZ did not return a gateway URL' },
        { status: 502 }
      )
    }

    const payment = await db.payment.upsert({
      where: { orderId: order.id },
      update: {
        userId: order.userId,
        method: 'online',
        gateway: 'sslcommerz',
        transactionId,
        status: 'pending',
        amount: order.totalAmount,
        gatewayResponse: appendPaymentLog(order.payment?.gatewayResponse, {
          event: 'initiate',
          status: String(response.status || 'pending'),
          transactionId,
          payload: response,
        }),
      },
      create: {
        orderId: order.id,
        userId: order.userId,
        method: 'online',
        gateway: 'sslcommerz',
        transactionId,
        status: 'pending',
        amount: order.totalAmount,
        gatewayResponse: appendPaymentLog(null, {
          event: 'initiate',
          status: String(response.status || 'pending'),
          transactionId,
          payload: response,
        }),
      },
    })

    await db.order.update({
      where: { id: order.id },
      data: { paymentMethod: 'online', paymentStatus: 'pending' },
    })

    await createAuditLog({
      adminId: authUser?.userId,
      action: 'payment_initiate',
      module: 'payments',
      referenceId: payment.id,
      newData: { orderId: order.id, transactionId, gateway: 'sslcommerz' },
    })

    return NextResponse.json({
      success: true,
      data: {
        gateway: 'sslcommerz',
        gatewayPageURL,
        transactionId,
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    })
  } catch (error) {
    console.error('Initiate SSLCOMMERZ payment error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
