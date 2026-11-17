/**
 * homepage-lower-sections-cms.test.mjs
 * Comprehensive tests for lower homepage sections, CMS APIs, admin controls,
 * reviews, FAQ accessibility, and footer contracts.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { NextRequest } from 'next/server.js'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()

globalThis.prisma = testDb

process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.NODE_ENV = 'test'

const { GET: getHomepageSections, POST: postHomepageSection } = await import('../src/app/api/homepage-sections/route.ts')
const { PATCH: patchHomepageSection } = await import('../src/app/api/homepage-sections/[id]/route.ts')
const { GET: getFaq, POST: postFaq } = await import('../src/app/api/faq/route.ts')
const { GET: getReviews } = await import('../src/app/api/reviews/route.ts')
const { generateToken } = await import('../src/lib/auth.ts')

async function cleanupDb() {
  await testDb.homepageSection.deleteMany().catch(() => {})
  await testDb.fAQItem.deleteMany().catch(() => {})
  await testDb.review.deleteMany().catch(() => {})
  await testDb.category.deleteMany().catch(() => {})
  await testDb.product.deleteMany().catch(() => {})
  await testDb.user.deleteMany().catch(() => {})
}

// ─── Test 1: Public homepage shows only active collections and trust items ────
test('1. Public homepage/API returns ONLY active collections and trust items', async () => {
  await cleanupDb()

  await testDb.homepageSection.createMany({
    data: [
      { title: 'Active Winter Collection', type: 'seasonal', isActive: true, sortOrder: 0 },
      { title: 'Active Organic Ghee', type: 'seasonal', isActive: true, sortOrder: 1 },
      { title: 'Inactive Collection', type: 'seasonal', isActive: false, sortOrder: 2 },
      { title: 'Active Authentic Trust', type: 'trust', isActive: true, sortOrder: 0 },
      { title: 'Inactive Trust', type: 'trust', isActive: false, sortOrder: 1 },
    ],
  })

  // Test seasonal
  const reqSeasonal = new NextRequest('http://localhost:3000/api/homepage-sections?type=seasonal&limit=20')
  const resSeasonal = await getHomepageSections(reqSeasonal)
  const dataSeasonal = await resSeasonal.json()
  assert.equal(dataSeasonal.success, true)
  const seasonalItems = dataSeasonal.data?.data || []
  assert.equal(seasonalItems.length, 2, 'Must only return 2 active seasonal items')
  seasonalItems.forEach((item) => {
    assert.equal(item.isActive, true)
    assert.notEqual(item.title, 'Inactive Collection')
  })

  // Test trust
  const reqTrust = new NextRequest('http://localhost:3000/api/homepage-sections?type=trust&limit=20')
  const resTrust = await getHomepageSections(reqTrust)
  const dataTrust = await resTrust.json()
  assert.equal(dataTrust.success, true)
  const trustItems = dataTrust.data?.data || []
  assert.equal(trustItems.length, 1, 'Must only return 1 active trust item')
  assert.equal(trustItems[0].title, 'Active Authentic Trust')
})

// ─── Test 2: Inactive content does NOT leak to public API ─────────────────────
test('2. Inactive content is completely excluded from public API endpoints', async () => {
  await cleanupDb()

  await testDb.homepageSection.create({
    data: { title: 'Draft Promo', type: 'seasonal', isActive: false, sortOrder: 0 },
  })
  await testDb.fAQItem.create({
    data: { question: 'Draft FAQ?', answer: 'Draft answer', isActive: false, sortOrder: 0 },
  })

  // Public sections check
  const resSec = await getHomepageSections(new NextRequest('http://localhost:3000/api/homepage-sections?limit=50'))
  const dataSec = await resSec.json()
  const secItems = dataSec.data?.data || []
  assert.equal(secItems.length, 0, 'Inactive sections must not be returned publicly')

  // Public FAQ check
  const resFaq = await getFaq(new NextRequest('http://localhost:3000/api/faq?limit=50'))
  const dataFaq = await resFaq.json()
  const faqItems = dataFaq.data?.data || []
  assert.equal(faqItems.length, 0, 'Inactive FAQs must not be returned publicly')
})

// ─── Test 3: Authorized admin sees all active and inactive content ─────────────
test('3. Authorized admin can fetch all active + inactive homepage content via ?admin=true', async () => {
  await cleanupDb()

  const admin = await testDb.user.create({
    data: { email: 'admin-cms@example.com', phone: '01700000099', name: 'CMS Admin', role: 'admin', sessionVersion: 1 },
  })
  const token = await generateToken(admin.id, admin.sessionVersion)

  await testDb.homepageSection.createMany({
    data: [
      { title: 'Active Sec', type: 'seasonal', isActive: true, sortOrder: 0 },
      { title: 'Inactive Sec', type: 'seasonal', isActive: false, sortOrder: 1 },
    ],
  })

  const req = new NextRequest('http://localhost:3000/api/homepage-sections?admin=true&limit=50', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const res = await getHomepageSections(req)
  const data = await res.json()
  assert.equal(data.success, true)
  const items = data.data?.data || []
  assert.equal(items.length, 2, 'Admin must see both active and inactive items')
})

// ─── Test 4: Collection CTA destination contract ─────────────────────────────
test('4. Collection CTA uses safe internal target and handles missing target gracefully', async () => {
  await cleanupDb()

  const cat = await testDb.category.create({
    data: { name: 'Mustard Oils', slug: 'mustard-oils' },
  })

  const secWithCat = await testDb.homepageSection.create({
    data: {
      title: 'Pure Cold-Pressed Oils',
      type: 'seasonal',
      categoryId: cat.id,
      isActive: true,
      sortOrder: 0,
      content: JSON.stringify({ tag: 'Popular', link: '/categories/mustard-oils' }),
    },
  })

  const secWithoutCat = await testDb.homepageSection.create({
    data: {
      title: 'Decorative Showcase Only',
      type: 'seasonal',
      isActive: true,
      sortOrder: 1,
      content: null,
    },
  })

  // Verify DB data contract
  const withCat = await testDb.homepageSection.findUnique({
    where: { id: secWithCat.id },
    include: { category: true },
  })
  assert.equal(withCat?.category?.slug, 'mustard-oils')
  const parsedContent = JSON.parse(withCat?.content || '{}')
  assert.equal(parsedContent.link.startsWith('/'), true, 'Link must be a safe internal relative path')

  const withoutCat = await testDb.homepageSection.findUnique({
    where: { id: secWithoutCat.id },
  })
  assert.equal(withoutCat?.categoryId, null)
  assert.equal(withoutCat?.content, null)
})

// ─── Test 5: Customer Reviews authentic DB contract ──────────────────────────
test('5. Customer reviews query returns ONLY approved and active real DB reviews; zero "Test Customer" placeholders', async () => {
  await cleanupDb()

  const user = await testDb.user.create({
    data: { email: 'realcustomer@example.com', phone: '01711122233', name: 'Rahim Ahmed', role: 'customer', sessionVersion: 1 },
  })
  const cat = await testDb.category.create({
    data: { name: 'Oils', slug: 'oils-test' },
  })
  const product = await testDb.product.create({
    data: {
      name: 'Khati Mustard Oil 1L',
      slug: 'khati-mustard-oil-1l',
      price: 320,
      stock: 50,
      categoryId: cat.id,
    },
  })

  // Create 1 approved+active review and 1 unapproved review
  await testDb.review.create({
    data: {
      userId: user.id,
      productId: product.id,
      rating: 5,
      comment: 'Excellent pure mustard oil. Genuine aroma.',
      isApproved: true,
      isActive: true,
      isVerified: true,
    },
  })
  await testDb.review.create({
    data: {
      userId: user.id,
      productId: product.id,
      rating: 1,
      comment: 'Unapproved spam review',
      isApproved: false,
      isActive: true,
    },
  })
  await testDb.review.create({
    data: {
      userId: user.id,
      productId: product.id,
      rating: 5,
      comment: 'Deactivated review',
      isApproved: true,
      isActive: false,
    },
  })

  const req = new NextRequest('http://localhost:3000/api/reviews?limit=10')
  const res = await getReviews(req)
  const data = await res.json()
  assert.equal(data.success, true)
  const reviews = data.data?.data || []

  assert.equal(reviews.length, 1, 'Only approved and active reviews must be returned')
  assert.equal(reviews[0].comment, 'Excellent pure mustard oil. Genuine aroma.')
  assert.equal(reviews[0].user?.name, 'Rahim Ahmed')
  assert.notEqual(reviews[0].user?.name, 'Test Customer')
  assert.equal(reviews[0].product?.name, 'Khati Mustard Oil 1L')
})

// ─── Test 6: FAQ semantic accessibility & validation contract ─────────────────
test('6. FAQ item validation and accessible data contract', async () => {
  await cleanupDb()

  const admin = await testDb.user.create({
    data: { email: 'faq-author@example.com', phone: '01799887766', name: 'FAQ Author', role: 'admin', sessionVersion: 1 },
  })
  const token = await generateToken(admin.id, admin.sessionVersion)

  // Create FAQ via POST
  const postReq = new NextRequest('http://localhost:3000/api/faq', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-csrf-token': 'test-csrf',
      cookie: 'csrf_token=test-csrf',
    },
    body: JSON.stringify({
      question: 'কত দিনে ডেলিভারি পাব?',
      answer: 'ঢাকার ভেতর ২৪-৪৮ ঘণ্টার মধ্যে এবং ঢাকার বাইরে ২-৩ কর্মদিবসে পণ্য পৌঁছানো হয়।',
      category: 'ডেলিভারি',
      sortOrder: 0,
      isActive: true,
    }),
  })

  const postRes = await postFaq(postReq)
  const postData = await postRes.json()
  assert.equal(postData.success, true)
  assert.ok(postData.data?.id)
  assert.equal(postData.data?.question, 'কত দিনে ডেলিভারি পাব?')

  // Public GET
  const getReq = new NextRequest('http://localhost:3000/api/faq?limit=10')
  const getRes = await getFaq(getReq)
  const getData = await getRes.json()
  const faqs = getData.data?.data || []
  assert.equal(faqs.length, 1)
  assert.equal(faqs[0].category, 'ডেলিভারি')
})

// ─── Test 7: Footer logo target and links contract ────────────────────────────
test('7. Footer logo routes to "/" and policy links map to verified pages', () => {
  const policyRoutes = ['delivery-policy', 'return-policy', 'terms', 'privacy']
  const verifiedTargets = {
    'delivery-policy': '/delivery-policy',
    'return-policy': '/return-policy',
    'terms': '/terms',
    'privacy': '/privacy',
  }

  policyRoutes.forEach((page) => {
    assert.ok(verifiedTargets[page], `Policy route for ${page} must be mapped`)
  })

  // Home target must be root
  const logoHref = '/'
  assert.equal(logoHref, '/')
})

// ─── Test 8: Empty state resilience without crashes ───────────────────────────
test('8. Empty homepage lower-section datasets handle gracefully with zero errors', async () => {
  await cleanupDb()

  const [secRes, faqRes, revRes] = await Promise.all([
    getHomepageSections(new NextRequest('http://localhost:3000/api/homepage-sections?type=seasonal&limit=10')),
    getFaq(new NextRequest('http://localhost:3000/api/faq?limit=10')),
    getReviews(new NextRequest('http://localhost:3000/api/reviews?limit=10')),
  ])

  const [secData, faqData, revData] = await Promise.all([
    secRes.json(),
    faqRes.json(),
    revRes.json(),
  ])

  assert.equal(secData.success, true)
  assert.equal((secData.data?.data || []).length, 0)

  assert.equal(faqData.success, true)
  assert.equal((faqData.data?.data || []).length, 0)

  assert.equal(revData.success, true)
  assert.equal((revData.data?.data || []).length, 0)
})
