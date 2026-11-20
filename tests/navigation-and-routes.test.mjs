import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const { getUrlForPage, setAppRouter, useAppStore } = await import('../src/lib/store.ts')

test('1. getUrlForPage maps all customer pages and actions to canonical routes', () => {
  assert.equal(getUrlForPage('home'), '/')
  assert.equal(getUrlForPage('login'), '/login')
  assert.equal(getUrlForPage('register'), '/register')
  assert.equal(getUrlForPage('cart'), '/cart')
  assert.equal(getUrlForPage('checkout'), '/checkout')
  assert.equal(getUrlForPage('profile'), '/profile')
  assert.equal(getUrlForPage('orders'), '/orders')
  assert.equal(getUrlForPage('wishlist'), '/wishlist')
  assert.equal(getUrlForPage('contact'), '/contact')
  assert.equal(getUrlForPage('terms'), '/terms')
  assert.equal(getUrlForPage('privacy'), '/privacy')
  assert.equal(getUrlForPage('delivery-policy'), '/delivery-policy')
  assert.equal(getUrlForPage('return-policy'), '/return-policy')
  assert.equal(getUrlForPage('forgot-password'), '/forgot-password')

  // Products & Category variations
  assert.equal(getUrlForPage('products'), '/products')
  assert.equal(getUrlForPage('products', { category: 'spices' }), '/categories/spices')
  assert.equal(
    getUrlForPage('products', { category: 'spices', subcategory: 'turmeric' }),
    '/products?category=spices&subcategory=turmeric'
  )
  assert.equal(getUrlForPage('products', { search: 'honey' }), '/products?search=honey')

  // Product detail
  assert.equal(getUrlForPage('product-detail', { slug: 'turmeric-powder' }), '/products/turmeric-powder')
  assert.equal(getUrlForPage('product-detail', { id: 'prod_123' }), '/products/prod_123')

  // Order detail & confirmation
  assert.equal(getUrlForPage('order-detail', { orderNumber: 'KK-12345' }), '/orders/KK-12345')
  assert.equal(getUrlForPage('order-confirmation', { orderNumber: 'KK-12345' }), '/orders/KK-12345?confirmed=true')
})

test('2. navigate triggers router.push with target canonical URL when app router is set', () => {
  const pushes = []
  const mockRouter = {
    push: (url) => {
      pushes.push(url)
    },
  }

  setAppRouter(mockRouter)

  // Navigate to login
  useAppStore.getState().navigate('login')
  assert.ok(pushes.includes('/login'), 'navigate("login") should push /login')

  // Navigate to category
  useAppStore.getState().navigate('products', { category: 'deshi-gur' })
  assert.ok(pushes.includes('/categories/deshi-gur'), 'navigate("products", { category }) should push /categories/deshi-gur')

  // Navigate to subcategory
  useAppStore.getState().navigate('products', { category: 'spices', subcategory: 'haldi' })
  assert.ok(
    pushes.includes('/products?category=spices&subcategory=haldi'),
    'navigate with subcategory should push query string route'
  )

  // Navigate to checkout
  useAppStore.getState().navigate('checkout')
  assert.ok(pushes.includes('/checkout'), 'navigate("checkout") should push /checkout')

  // Reset router
  setAppRouter(null)
})

test('3. Verification that required App Router pages exist on filesystem', () => {
  const root = path.resolve(process.cwd(), 'src/app')
  const requiredRoutes = [
    'products/page.tsx',
    'products/[slug]/page.tsx',
    'categories/[slug]/page.tsx',
    'login/page.tsx',
    'register/page.tsx',
    'cart/page.tsx',
    'checkout/page.tsx',
    'orders/page.tsx',
    'orders/[orderNumber]/page.tsx',
    'profile/page.tsx',
    'contact/page.tsx',
    'wishlist/page.tsx',
    'forgot-password/page.tsx',
  ]

  for (const rel of requiredRoutes) {
    const full = path.join(root, rel)
    assert.ok(fs.existsSync(full), `Expected page route ${rel} to exist on filesystem`)
  }
})
