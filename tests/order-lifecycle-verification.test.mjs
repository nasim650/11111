import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { NextRequest } from 'next/server.js'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()
globalThis.prisma = testDb
test.after(async () => {
  await testDb.$disconnect()
})

process.env.NODE_ENV = 'test'
process.env.APP_SECRET = 'test-secret-key-at-least-32-chars-long-for-hmac'
process.env.NEXTAUTH_SECRET = 'test-secret-key-at-least-32-chars-long-for-hmac'

const { PUT, GET } = await import('../src/app/api/orders/[id]/route.ts')
const { generateToken } = await import('../src/lib/auth.ts')

function request(url, token, body) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    authorization: `Bearer ${token}`,
  })
  return new NextRequest(url, {
    method: body ? 'PUT' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

test('admin lifecycle transitions are visible through customer order retrieval', async () => {
  const suffix = Date.now()
  const customer = await testDb.user.create({
    data: {
      name: 'Lifecycle Customer',
      email: `lifecycle-${suffix}@test.local`,
      phone: `017${String(suffix).slice(-8)}`,
      role: 'customer',
      isVerified: true,
    },
  })
  const admin = await testDb.user.create({
    data: {
      name: 'Lifecycle Admin',
      email: `admin-${suffix}@test.local`,
      role: 'admin',
      isVerified: true,
    },
  })
  const category = await testDb.category.create({
    data: { name: `Lifecycle Category ${suffix}`, slug: `lifecycle-${suffix}` },
  })
  const product = await testDb.product.create({
    data: {
      name: 'Lifecycle Product',
      slug: `lifecycle-product-${suffix}`,
      price: 100,
      stock: 10,
      categoryId: category.id,
    },
  })
  const order = await testDb.order.create({
    data: {
      orderNumber: `LIFECYCLE-${suffix}`,
      userId: customer.id,
      guestName: customer.name,
      guestPhone: customer.phone,
      guestAddress: 'Dhaka',
      totalAmount: 160,
      deliveryCharge: 60,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      items: {
        create: [{
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unit: 'piece',
          price: 100,
        }],
      },
      statusHistory: {
        create: [{ status: 'pending', note: 'Order placed' }],
      },
    },
  })

  const adminToken = await generateToken(admin.id, admin.sessionVersion)
  const customerToken = await generateToken(customer.id, customer.sessionVersion)
  const transitions = ['confirmed', 'processing', 'packed', 'ready_to_ship', 'shipped', 'delivered']

  for (const status of transitions) {
    const updateResponse = await PUT(
      request(`http://localhost/api/orders/${order.id}`, adminToken, { orderStatus: status }),
      { params: Promise.resolve({ id: order.id }) },
    )
    assert.equal(updateResponse.status, 200, `Admin transition to ${status} should succeed`)

    const customerResponse = await GET(
      request(`http://localhost/api/orders/${order.id}`, customerToken),
      { params: Promise.resolve({ id: order.id }) },
    )
    assert.equal(customerResponse.status, 200)
    const customerData = await customerResponse.json()
    assert.equal(customerData.data.orderStatus, status)
  }

  const history = await testDb.orderStatusHistory.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: 'asc' },
  })
  assert.deepEqual(
    history.map((entry) => entry.status),
    ['pending', ...transitions],
  )

  await testDb.$disconnect()
})
