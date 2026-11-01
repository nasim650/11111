import type { Metadata } from 'next'
import CustomerShell from '@/components/layout/CustomerShell'
import CartPage from '@/components/pages/CartPage'

export const metadata: Metadata = {
  title: 'Shopping Cart - Khati Khadyo',
  description: 'Review your selected authentic Bangladeshi grocery products in your shopping cart.',
  alternates: {
    canonical: '/cart',
  },
}

export default function CartRoute() {
  return (
    <CustomerShell>
      <CartPage />
    </CustomerShell>
  )
}
