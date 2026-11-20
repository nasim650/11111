import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { getBaseUrl } from '@/lib/site-url'
import CustomerShell from '@/components/layout/CustomerShell'
import ProductsPage from '@/components/pages/ProductsPage'

interface Props {
  params: Promise<{ slug: string }>
}

async function getCategoryBySlug(slug: string) {
  return db.category.findUnique({
    where: { slug },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)

  if (!category || !category.isActive) {
    return {
      title: 'Category Not Found | Khati Khadyo',
      description: 'The requested category could not be found.',
    }
  }

  const baseUrl = getBaseUrl()
  const title = `${category.name} | Khati Khadyo`
  const description = category.description || `Explore our authentic ${category.name} collection at Khati Khadyo. Pure, fresh, and direct from sources across Bangladesh.`

  return {
    title,
    description,
    alternates: {
      canonical: `/categories/${category.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/categories/${category.slug}`,
      siteName: 'Khati Khadyo',
      type: 'website',
      images: [
        {
          url: category.image || '/all_logo.png',
          alt: category.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [category.image || '/all_logo.png'],
    },
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)

  // 3. Unknown category returns HTTP 404
  if (!category || !category.isActive) {
    notFound()
  }

  const baseUrl = getBaseUrl()

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Products',
        item: `${baseUrl}/products`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: category.name,
        item: `${baseUrl}/categories/${category.slug}`,
      },
    ],
  }

  return (
    <CustomerShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ProductsPage initialCategorySlug={category.slug} />
    </CustomerShell>
  )
}
