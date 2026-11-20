import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/site-url'
import CustomerShell from '@/components/layout/CustomerShell'
import PrivacyPage from '@/components/pages/PrivacyPage'

export const metadata: Metadata = {
  title: 'Privacy Policy | Khati Khadyo',
  description: 'Learn how Khati Khadyo collects, protects, and handles your personal information with strict data privacy standards.',
  alternates: {
    canonical: '/privacy-policy',
  },
  openGraph: {
    title: 'Privacy Policy | Khati Khadyo',
    description: 'Learn how Khati Khadyo protects your personal information.',
    url: `${getBaseUrl()}/privacy-policy`,
    siteName: 'Khati Khadyo',
    images: [{ url: '/all_logo.png' }],
  },
}

export default function Page() {
  return (
    <CustomerShell>
      <PrivacyPage />
    </CustomerShell>
  )
}
