import type { Metadata } from 'next'
import CustomerShell from '@/components/layout/CustomerShell'
import WishlistPage from '@/components/pages/WishlistPage'

export const metadata: Metadata = {
  title: 'Wishlist - Khati Khadyo',
  description: 'Your saved favorite authentic products at Khati Khadyo.',
}

export default function WishlistRoute() {
  return (
    <CustomerShell>
      <WishlistPage />
    </CustomerShell>
  )
}
