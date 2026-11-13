import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { getBaseUrl } from '@/lib/site-url'
import CustomerShell from '@/components/layout/CustomerShell'
import ProductDetailPage from '@/components/pages/ProductDetailPage'

interface Props {
  params: Promise<{ slug: string }>
}

async function getProductBySlug(slug: string) {
  return db.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      category: { select: { id: true, name: true, slug: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
      reviews: {
        where: { isApproved: true },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product || product.status !== 'active') {
    return {
      title: 'Product Not Found | Khati Khadyo',
      description: 'The requested product could not be found.',
    }
  }

  const baseUrl = getBaseUrl()
  const title = `${product.name} | Khati Khadyo`
  const rawDesc = product.shortDescription || product.description || ''
  const cleanDesc = rawDesc.replace(/<[^>]*>/g, '').trim().slice(0, 160) || '100% authentic, pure Bangladeshi food product from Khati Khadyo.'
  const primaryImage = product.images?.[0]?.url || '/all_logo.png'

  return {
    title,
    description: cleanDesc,
    alternates: {
      canonical: `/products/${product.slug}`,
    },
    openGraph: {
      title,
      description: cleanDesc,
      url: `${baseUrl}/products/${product.slug}`,
      siteName: 'Khati Khadyo',
      type: 'website',
      images: [
        {
          url: primaryImage,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: cleanDesc,
      images: [primaryImage],
    },
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  // 3. Unknown slug returns HTTP 404
  if (!product || product.status !== 'active') {
    notFound()
  }

  const baseUrl = getBaseUrl()
  const inStock = (product.stock ?? 0) > 0
  const effectivePrice = product.discountPrice != null ? product.discountPrice : product.price
  const primaryImage = product.images?.[0]?.url || `${baseUrl}/all_logo.png`

  // Product JSON-LD (Schema.org)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: (product.shortDescription || product.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 200),
    image: product.images?.length ? product.images.map((img) => img.url) : [primaryImage],
    sku: product.id,
    brand: {
      '@type': 'Brand',
      name: 'Khati Khadyo',
    },
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/products/${product.slug}`,
      priceCurrency: 'BDT',
      price: String(effectivePrice),
      // Out of stock maps to OutOfStock, not 404
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    ...(product.reviews?.length
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: (
              product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
            ).toFixed(1),
            reviewCount: String(product.reviews.length),
          },
        }
      : {}),
  }

  // Serialize product for client component
  const serializedProduct = {
    ...product,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    reviews: product.reviews?.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })) || [],
  }

  return (
    <CustomerShell>
      {/* Inject JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailPage initialProduct={serializedProduct as any} />
    </CustomerShell>
  )
}
