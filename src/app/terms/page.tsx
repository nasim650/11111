import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/site-url'
import CustomerShell from '@/components/layout/CustomerShell'
import TermsPage from '@/components/pages/TermsPage'

export const metadata: Metadata = {
  title: 'Terms & Conditions | Khati Khadyo',
  description: 'Terms and conditions for using Khati Khadyo e-commerce services, ordering authentic food products, and customer policies.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms & Conditions | Khati Khadyo',
    description: 'Terms and conditions for Khati Khadyo services and ordering.',
    url: `${getBaseUrl()}/terms`,
    siteName: 'Khati Khadyo',
    images: [{ url: '/all_logo.png' }],
  },
}

export default function Page() {
  return (
    <CustomerShell>
      <TermsPage />
    </CustomerShell>
  )
}
