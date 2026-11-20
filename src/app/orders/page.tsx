import type { Metadata } from 'next'
import { Suspense } from 'react'
import CustomerShell from '@/components/layout/CustomerShell'
import OrdersPage from '@/components/pages/OrdersPage'

export const metadata: Metadata = {
  title: 'আমার অর্ডার সমূহ - Khati Khadyo',
  description: 'আপনার সমস্ত পূর্ববর্তী এবং চলমান অর্ডারের তালিকা ও ট্র্যাকিং।',
  robots: {
    index: false,
    follow: false,
  },
}

function OrdersLoadingFallback() {
  return (
    <div
      role="status"
      aria-label="Loading orders"
      className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-stone-600">অর্ডার সমূহ লোড হচ্ছে...</p>
      <span className="sr-only">Loading orders...</span>
    </div>
  )
}

export default function OrdersRoute() {
  return (
    <CustomerShell>
      <Suspense fallback={<OrdersLoadingFallback />}>
        <OrdersPage />
      </Suspense>
    </CustomerShell>
  )
}
