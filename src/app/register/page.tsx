import type { Metadata } from 'next'
import { Suspense } from 'react'
import CustomerShell from '@/components/layout/CustomerShell'
import RegisterPage from '@/components/pages/RegisterPage'

export const metadata: Metadata = {
  title: 'রেজিস্ট্রেশন - Khati Khadyo',
  description: 'খাঁটি খাদ্যে নতুন অ্যাকাউন্ট তৈরি করুন।',
  robots: {
    index: false,
    follow: false,
  },
}

function RegisterLoadingFallback() {
  return (
    <div
      role="status"
      aria-label="Loading registration"
      className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-stone-600">রেজিস্ট্রেশন পেজ লোড হচ্ছে...</p>
      <span className="sr-only">Loading registration...</span>
    </div>
  )
}

export default function RegisterRoute() {
  return (
    <CustomerShell>
      <Suspense fallback={<RegisterLoadingFallback />}>
        <RegisterPage />
      </Suspense>
    </CustomerShell>
  )
}
