import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/site-url'
import CustomerShell from '@/components/layout/CustomerShell'
import ReturnPolicyPage from '@/components/pages/ReturnPolicyPage'

export const metadata: Metadata = {
  title: 'Return Policy | Khati Khadyo',
  description: 'Read the Khati Khadyo return & refund policy. Hassle-free returns and quality guarantee on all authentic food products.',
  alternates: {
    canonical: '/return-policy',
  },
  openGraph: {
    title: 'Return Policy | Khati Khadyo',
    description: 'Read the Khati Khadyo return & refund policy.',
    url: `${getBaseUrl()}/return-policy`,
    siteName: 'Khati Khadyo',
    images: [{ url: '/all_logo.png' }],
  },
}

export default function Page() {
  return (
    <CustomerShell>
      <ReturnPolicyPage />
    </CustomerShell>
  )
}
