import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { getBaseUrl } from '@/lib/site-url'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()

  // 1. Static implemented public routes
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/delivery-policy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/privacy-policy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/return-policy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ]

  try {
    // 2. Active products with direct canonical slug URLs
    const products = await db.product.findMany({
      where: { status: 'active' },
      select: { slug: true, updatedAt: true },
      take: 1000,
    })

    const productPages: MetadataRoute.Sitemap = products
      .filter((p) => Boolean(p.slug))
      .map((product) => ({
        url: `${baseUrl}/products/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.8,
      }))

    // 3. Active categories with direct canonical slug URLs
    const categories = await db.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    })

    const categoryPages: MetadataRoute.Sitemap = categories
      .filter((c) => Boolean(c.slug))
      .map((category) => ({
        url: `${baseUrl}/categories/${category.slug}`,
        lastModified: category.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.7,
      }))

    return [...staticPages, ...productPages, ...categoryPages]
  } catch (error) {
    console.error('Failed to generate dynamic sitemap:', error)
    return staticPages
  }
}
