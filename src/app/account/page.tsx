import type { Metadata } from 'next'
import { Suspense } from 'react'
import CustomerShell from '@/components/layout/CustomerShell'
import ProfilePage from '@/components/pages/ProfilePage'

export const metadata: Metadata = {
  title: 'আমার অ্যাকাউন্ট - Khati Khadyo',
  description: 'আপনার খাঁটি খাদ্য অ্যাকাউন্ট এবং অর্ডার ইতিহাস পরিচালনা করুন।',
  robots: {
    index: false,
    follow: false,
  },
}

function AccountLoadingFallback() {
  return (
    <div
      role="status"
      aria-label="Loading account"
      className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-stone-600">অ্যাকাউন্ট লোড হচ্ছে...</p>
      <span className="sr-only">Loading account...</span>
    </div>
  )
}

export default function AccountRoute() {
  return (
    <CustomerShell>
      <Suspense fallback={<AccountLoadingFallback />}>
        <ProfilePage />
      </Suspense>
    </CustomerShell>
  )
}
