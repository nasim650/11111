import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/site-url'
import CustomerShell from '@/components/layout/CustomerShell'
import DeliveryPolicyPage from '@/components/pages/DeliveryPolicyPage'

export const metadata: Metadata = {
  title: 'Delivery Policy | Khati Khadyo',
  description: 'Learn about Khati Khadyo delivery policy, coverage across all 64 districts of Bangladesh, shipping timelines, and free shipping terms.',
  alternates: {
    canonical: '/delivery-policy',
  },
  openGraph: {
    title: 'Delivery Policy | Khati Khadyo',
    description: 'Learn about Khati Khadyo delivery policy and nationwide shipping information.',
    url: `${getBaseUrl()}/delivery-policy`,
    siteName: 'Khati Khadyo',
    images: [{ url: '/all_logo.png' }],
  },
}

export default function Page() {
  return (
    <CustomerShell>
      <DeliveryPolicyPage />
    </CustomerShell>
  )
}
