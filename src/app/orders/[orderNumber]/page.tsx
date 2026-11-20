import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import CustomerShell from '@/components/layout/CustomerShell'
import { getServerSessionUser } from '@/lib/server-auth'
import { getOrderForUser } from '@/lib/order-authorization'
import { sanitizeInternalRedirect } from '@/lib/security'
import OrderDetailView from '@/components/pages/OrderDetailView'

interface OrderRouteProps {
  params: Promise<{ orderNumber: string }>
  searchParams: Promise<{ payment?: string }>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}): Promise<Metadata> {
  const { orderNumber } = await params
  return {
    title: `Order #${orderNumber} - Khati Khadyo`,
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function OrderDetailRoute({
  params,
  searchParams,
}: OrderRouteProps) {
  const { orderNumber } = await params
  const { payment: paymentCallbackStatus } = await searchParams

  const sessionUser = await getServerSessionUser()
  const cookieStore = await cookies()
  const guestToken =
    cookieStore.get(`guest_order_${orderNumber}`)?.value ||
    cookieStore.get('guest_order_access')?.value ||
    null

  // 1. Unauthenticated Request: Safe Login Redirect
  if (!sessionUser) {
    if (!guestToken) {
      const rawTarget = paymentCallbackStatus
        ? `/orders/${encodeURIComponent(orderNumber)}?payment=${encodeURIComponent(paymentCallbackStatus)}`
        : `/orders/${encodeURIComponent(orderNumber)}`

      const safeNext = sanitizeInternalRedirect(rawTarget, '/')
      redirect(`/login?next=${encodeURIComponent(safeNext)}`)
    }
  }

  // 2. Fetch and Authorize Order
  const result = await getOrderForUser(orderNumber, sessionUser, undefined, guestToken)

  // 3. Unauthorized customer OR truly unknown order returns 404 (notFound())
  // This eliminates order existence enumeration attacks by returning identical HTTP 404
  if (result.status === 404 || !result.order) {
    notFound()
  }

  // 4. Authorized owner, verified guest or admin/manager renders order details
  return (
    <CustomerShell>
      <OrderDetailView
        order={result.order}
        paymentCallbackStatus={paymentCallbackStatus}
      />
    </CustomerShell>
  )
}
