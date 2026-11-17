import type { Metadata } from 'next'
import { Suspense } from 'react'
import CustomerShell from '@/components/layout/CustomerShell'
import CheckoutPage from '@/components/pages/CheckoutPage'

export const metadata: Metadata = {
  title: 'Secure Checkout - Khati Khadyo',
  description: 'Complete your authentic Bangladeshi grocery order safely and securely.',
  robots: {
    index: false,
    follow: false,
  },
}

function CheckoutLoadingFallback() {
  return (
    <div
      role="status"
      aria-label="Loading checkout"
      className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-stone-600">চেকআউট পেজ লোড হচ্ছে...</p>
      <span className="sr-only">Loading checkout...</span>
    </div>
  )
}

export default function CheckoutRoute() {
  return (
    <CustomerShell>
      <Suspense fallback={<CheckoutLoadingFallback />}>
        <CheckoutPage />
      </Suspense>
    </CustomerShell>
  )
}
