import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/site-url'
import CustomerShell from '@/components/layout/CustomerShell'
import ProductsPage from '@/components/pages/ProductsPage'

export const metadata: Metadata = {
  title: 'All Products | Khati Khadyo',
  description: 'Browse our full collection of 100% authentic, pure Bangladeshi food products. Deshi ghee, organic honey, spices, rice, and traditional pantry staples.',
  alternates: {
    canonical: '/products',
  },
  openGraph: {
    title: 'All Products | Khati Khadyo',
    description: 'Browse our full collection of 100% authentic, pure Bangladeshi food products.',
    url: `${getBaseUrl()}/products`,
    siteName: 'Khati Khadyo',
    images: [{ url: '/all_logo.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All Products | Khati Khadyo',
    description: 'Browse our full collection of 100% authentic, pure Bangladeshi food products.',
    images: ['/all_logo.png'],
  },
}

export default function Page() {
  return (
    <CustomerShell>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <ProductsPage />
      </Suspense>
    </CustomerShell>
  )
}
