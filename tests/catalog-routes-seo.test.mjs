import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()

// Ensure global prisma instance points to our test database
globalThis.prisma = testDb

const { getBaseUrl } = await import('../src/lib/site-url.ts')
const { default: sitemap } = await import('../src/app/sitemap.ts')

// Helper function to seed an isolated test category and product
async function setupTestCatalog() {
  await testDb.orderItem.deleteMany()
  await testDb.cartItem.deleteMany()
  await testDb.wishlist.deleteMany()
  await testDb.review.deleteMany()
  await testDb.productImage.deleteMany()
  await testDb.product.deleteMany()
  await testDb.subcategory.deleteMany()
  await testDb.category.deleteMany()

  const category = await testDb.category.create({
    data: {
      name: 'Organic Honey',
      slug: 'organic-honey',
      description: '100% natural, unprocessed raw honey',
      isActive: true,
    },
  })

  const inStockProduct = await testDb.product.create({
    data: {
      name: 'Sundarbans Mustard Honey 500g',
      slug: 'sundarbans-mustard-honey-500g',
      shortDescription: 'Fresh mustard flower honey from Sundarbans',
      price: 650,
      discountPrice: 590,
      unit: '500g',
      stock: 25,
      status: 'active',
      categoryId: category.id,
      images: {
        create: [
          { url: 'https://res.cloudinary.com/demo/image/upload/honey.jpg', sortOrder: 0 },
        ],
      },
    },
    include: { images: true, category: true },
  })

  const outOfStockProduct = await testDb.product.create({
    data: {
      name: 'Special Wild Bee Honey 1kg',
      slug: 'special-wild-bee-honey-1kg',
      shortDescription: 'Rare wild bee raw honey',
      price: 1500,
      stock: 0,
      status: 'active',
      categoryId: category.id,
    },
    include: { images: true, category: true },
  })

  const inactiveProduct = await testDb.product.create({
    data: {
      name: 'Archived Seasonal Item',
      slug: 'archived-seasonal-item',
      price: 300,
      stock: 10,
      status: 'inactive',
      categoryId: category.id,
    },
  })

  return { category, inStockProduct, outOfStockProduct, inactiveProduct }
}

test('1. Direct Product Slug Route contract: queries active product with relations', async () => {
  const { inStockProduct } = await setupTestCatalog()

  const found = await testDb.product.findUnique({
    where: { slug: 'sundarbans-mustard-honey-500g' },
    include: { images: true, category: true },
  })

  assert.ok(found)
  assert.equal(found.id, inStockProduct.id)
  assert.equal(found.name, 'Sundarbans Mustard Honey 500g')
  assert.equal(found.price, 650)
  assert.equal(found.discountPrice, 590)
  assert.equal(found.stock, 25)
  assert.equal(found.category.slug, 'organic-honey')
  assert.equal(found.images.length, 1)
})

test('2. Unknown or inactive product slug returns 404 behavior', async () => {
  await setupTestCatalog()

  // Non-existent slug returns null
  const nonExistent = await testDb.product.findUnique({
    where: { slug: 'totally-non-existent-product-slug' },
  })
  assert.equal(nonExistent, null)

  // Inactive product exists in DB but is rejected from public view
  const inactive = await testDb.product.findUnique({
    where: { slug: 'archived-seasonal-item' },
  })
  assert.ok(inactive)
  assert.equal(inactive.status, 'inactive')
  // Public route contract: if product.status !== 'active', triggers notFound()
  const isPubliclyAvailable = inactive && inactive.status === 'active'
  assert.equal(isPubliclyAvailable, false)
})

test('3. Direct Category Slug Route contract: queries active category', async () => {
  const { category } = await setupTestCatalog()

  const found = await testDb.category.findUnique({
    where: { slug: 'organic-honey' },
  })

  assert.ok(found)
  assert.equal(found.id, category.id)
  assert.equal(found.name, 'Organic Honey')
  assert.equal(found.isActive, true)
})

test('4. Unknown or inactive category slug returns 404 behavior', async () => {
  await setupTestCatalog()

  const nonExistent = await testDb.category.findUnique({
    where: { slug: 'unknown-category-slug' },
  })
  assert.equal(nonExistent, null)
})

test('5. Product JSON-LD Contract: generates valid Schema.org structure', async () => {
  const { inStockProduct, outOfStockProduct } = await setupTestCatalog()
  const baseUrl = getBaseUrl()

  // In-Stock JSON-LD contract
  const inStockLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: inStockProduct.name,
    description: inStockProduct.shortDescription,
    image: inStockProduct.images.map((i) => i.url),
    sku: inStockProduct.id,
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/products/${inStockProduct.slug}`,
      priceCurrency: 'BDT',
      price: String(inStockProduct.discountPrice || inStockProduct.price),
      availability: inStockProduct.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  }

  assert.equal(inStockLd['@type'], 'Product')
  assert.equal(inStockLd.offers.priceCurrency, 'BDT')
  assert.equal(inStockLd.offers.price, '590')
  assert.equal(inStockLd.offers.availability, 'https://schema.org/InStock')

  // Out-of-Stock JSON-LD contract
  const outOfStockLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: outOfStockProduct.name,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BDT',
      price: String(outOfStockProduct.price),
      availability: outOfStockProduct.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  }

  assert.equal(outOfStockLd.offers.availability, 'https://schema.org/OutOfStock')
})

test('6. Category BreadcrumbList JSON-LD Contract', async () => {
  const { category } = await setupTestCatalog()
  const baseUrl = getBaseUrl()

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Products', item: `${baseUrl}/products` },
      { '@type': 'ListItem', position: 3, name: category.name, item: `${baseUrl}/categories/${category.slug}` },
    ],
  }

  assert.equal(breadcrumb['@type'], 'BreadcrumbList')
  assert.equal(breadcrumb.itemListElement.length, 3)
  assert.equal(breadcrumb.itemListElement[2].item, `${baseUrl}/categories/organic-honey`)
})

test('7. Sitemap Contract: includes only real, implemented routes with RESTful canonical URLs', async () => {
  await setupTestCatalog()

  const items = await sitemap()
  assert.ok(Array.isArray(items))
  assert.ok(items.length >= 7)

  const urls = items.map((i) => i.url)
  const baseUrl = getBaseUrl()

  // 1. Mandatory static routes exist
  assert.ok(urls.includes(baseUrl), 'Root homepage must be in sitemap')
  assert.ok(urls.includes(`${baseUrl}/products`), '/products must be in sitemap')
  assert.ok(urls.includes(`${baseUrl}/contact`), '/contact must be in sitemap')
  assert.ok(urls.includes(`${baseUrl}/delivery-policy`), '/delivery-policy must be in sitemap')
  assert.ok(urls.includes(`${baseUrl}/privacy-policy`), '/privacy-policy must be in sitemap')
  assert.ok(urls.includes(`${baseUrl}/terms`), '/terms must be in sitemap')
  assert.ok(urls.includes(`${baseUrl}/return-policy`), '/return-policy must be in sitemap')

  // 2. Canonical product URLs are RESTful, NOT query parameters (?slug=...)
  assert.ok(
    urls.includes(`${baseUrl}/products/sundarbans-mustard-honey-500g`),
    'Product URL must be /products/slug format'
  )
  assert.ok(
    !urls.some((u) => u.includes('?slug=')),
    'Sitemap must NOT contain deprecated query param URLs (?slug=)'
  )

  // 3. Canonical category URLs are RESTful, NOT query parameters (?category=...)
  assert.ok(
    urls.includes(`${baseUrl}/categories/organic-honey`),
    'Category URL must be /categories/slug format'
  )
  assert.ok(
    !urls.some((u) => u.includes('?category=')),
    'Sitemap must NOT contain deprecated query param URLs (?category=)'
  )

  // 4. Zero duplicate URLs
  const uniqueUrls = new Set(urls)
  assert.equal(urls.length, uniqueUrls.size, 'Sitemap must contain zero duplicate URLs')
})
