import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/site-url'
import CustomerShell from '@/components/layout/CustomerShell'
import ContactPage from '@/components/pages/ContactPage'

export const metadata: Metadata = {
  title: 'Contact Us | Khati Khadyo',
  description: 'Have a question or feedback? Contact the Khati Khadyo support team. We deliver authentic, pure Bangladeshi food products nationwide.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact Us | Khati Khadyo',
    description: 'Get in touch with Khati Khadyo. Authentic Bangladeshi food products delivered fresh.',
    url: `${getBaseUrl()}/contact`,
    siteName: 'Khati Khadyo',
    images: [{ url: '/all_logo.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Us | Khati Khadyo',
    description: 'Get in touch with Khati Khadyo. Authentic Bangladeshi food products delivered fresh.',
    images: ['/all_logo.png'],
  },
}

export default function Page() {
  return (
    <CustomerShell>
      <ContactPage />
    </CustomerShell>
  )
}
