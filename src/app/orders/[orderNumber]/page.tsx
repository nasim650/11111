import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CustomerShell from '@/components/layout/CustomerShell'
import { getServerSessionUser } from '@/lib/server-auth'
import { getOrderForUser } from '@/lib/order-authorization'
import OrderDetailView from '@/components/pages/OrderDetailView'
import OrderAuthErrorView from '@/components/pages/OrderAuthErrorView'

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
  const result = await getOrderForUser(orderNumber, sessionUser)

  if (result.status === 404) {
    notFound()
  }

  if (result.status === 401 || result.status === 403) {
    return (
      <CustomerShell>
        <OrderAuthErrorView
          status={result.status}
          error={result.error}
          orderNumber={orderNumber}
        />
      </CustomerShell>
    )
  }

  return (
    <CustomerShell>
      <OrderDetailView
        order={result.order}
        paymentCallbackStatus={paymentCallbackStatus}
      />
    </CustomerShell>
  )
}
