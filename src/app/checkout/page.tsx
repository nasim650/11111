import type { Metadata } from 'next'
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

export default function CheckoutRoute() {
  return (
    <CustomerShell>
      <CheckoutPage />
    </CustomerShell>
  )
}
