import type { Metadata } from 'next'
import { Suspense } from 'react'
import CustomerShell from '@/components/layout/CustomerShell'
import ProfilePage from '@/components/pages/ProfilePage'

export const metadata: Metadata = {
  title: 'আমার প্রোফাইল - Khati Khadyo',
  description: 'আপনার খাঁটি খাদ্য প্রোফাইল এবং সংরক্ষিত ঠিকানা পরিচালনা করুন।',
  robots: {
    index: false,
    follow: false,
  },
}

function ProfileLoadingFallback() {
  return (
    <div
      role="status"
      aria-label="Loading profile"
      className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-stone-600">প্রোফাইল লোড হচ্ছে...</p>
      <span className="sr-only">Loading profile...</span>
    </div>
  )
}

export default function ProfileRoute() {
  return (
    <CustomerShell>
      <Suspense fallback={<ProfileLoadingFallback />}>
        <ProfilePage />
      </Suspense>
    </CustomerShell>
  )
}
