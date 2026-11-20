import type { Metadata } from 'next'
import { Suspense } from 'react'
import CustomerShell from '@/components/layout/CustomerShell'
import LoginPage from '@/components/pages/LoginPage'

export const metadata: Metadata = {
  title: 'লগইন - Khati Khadyo',
  description: 'আপনার খাঁটি খাদ্য অ্যাকাউন্টে লগইন করুন।',
  robots: {
    index: false,
    follow: false,
  },
}

function LoginLoadingFallback() {
  return (
    <div
      role="status"
      aria-label="Loading login"
      className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-stone-600">লগইন পেজ লোড হচ্ছে...</p>
      <span className="sr-only">Loading login...</span>
    </div>
  )
}

export default function LoginRoute() {
  return (
    <CustomerShell>
      <Suspense fallback={<LoginLoadingFallback />}>
        <LoginPage />
      </Suspense>
    </CustomerShell>
  )
}
