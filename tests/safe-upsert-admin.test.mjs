import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../prisma/generated/test-client')
const testDb = new PrismaClient()

// Ensure global prisma instance points to our test database
globalThis.prisma = testDb

const { safeUpsertAdmin, maskEmail } = await import('../scripts/safe-upsert-admin.ts')
const { verifyPassword } = await import('../src/lib/auth.ts')

async function cleanUsersAndRelated() {
  await testDb.auditLog.deleteMany()
  await testDb.orderItem.deleteMany()
  await testDb.payment.deleteMany()
  await testDb.deliveryLabel.deleteMany()
  await testDb.order.deleteMany()
  await testDb.product.deleteMany()
  await testDb.category.deleteMany()
  await testDb.coupon.deleteMany()
  await testDb.user.deleteMany()
}

test('1. Mask email utility works correctly and hides private characters', () => {
  assert.equal(maskEmail('admin@khatikhadyo.com'), 'a***n@khatikhadyo.com')
  assert.equal(maskEmail('support@khatikhadyo.com'), 's***t@khatikhadyo.com')
  assert.equal(maskEmail('me@domain.com'), 'm***@domain.com')
  assert.equal(maskEmail('invalid-email'), '***')
})

test('2. New user -> safely creates admin user with bcrypt hash', async () => {
  await cleanUsersAndRelated()

  const result = await safeUpsertAdmin({
    email: 'newadmin@khatikhadyo.com',
    password: 'StrongAdminPass123!',
    name: 'Super Admin',
    isProduction: false,
    dbClient: testDb,
  })

  assert.equal(result.success, true)
  assert.equal(result.action, 'created')
  assert.equal(result.maskedEmail, 'n***n@khatikhadyo.com')
  assert.equal(result.role, 'admin')
  assert.equal(result.isActive, true)

  const user = await testDb.user.findUnique({ where: { email: 'newadmin@khatikhadyo.com' } })
  assert.ok(user, 'User should be found in database')
  assert.equal(user.role, 'admin')
  assert.equal(user.isActive, true)
  assert.equal(user.isVerified, true)
  assert.equal(user.name, 'Super Admin')
  assert.equal(user.sessionVersion, 1)

  // Plaintext password must never be stored
  assert.notEqual(user.password, 'StrongAdminPass123!')
  const passwordValid = await verifyPassword('StrongAdminPass123!', user.password)
  assert.equal(passwordValid, true, 'Stored password must match bcrypt hash')
})

test('3. Existing non-admin user -> safely promotes to admin and updates credentials', async () => {
  await cleanUsersAndRelated()

  // Seed customer user
  const existingCustomer = await testDb.user.create({
    data: {
      email: 'customer@khatikhadyo.com',
      password: 'OldCustomerPassword!',
      name: 'Regular Customer',
      role: 'customer',
      isActive: false,
      isVerified: false,
      sessionVersion: 1,
    },
  })

  const result = await safeUpsertAdmin({
    email: 'customer@khatikhadyo.com',
    password: 'NewAdminSecurePassword999!',
    isProduction: false,
    dbClient: testDb,
  })

  assert.equal(result.success, true)
  assert.equal(result.action, 'updated')
  assert.equal(result.role, 'admin')
  assert.equal(result.isActive, true)

  const updated = await testDb.user.findUnique({ where: { id: existingCustomer.id } })
  assert.equal(updated.role, 'admin', 'Role must be updated to admin')
  assert.equal(updated.isActive, true, 'User must be activated')
  assert.equal(updated.isVerified, true, 'User must be verified')
  assert.equal(updated.sessionVersion, 2, 'Session version must be incremented')

  // Verify new password
  const newPassValid = await verifyPassword('NewAdminSecurePassword999!', updated.password)
  assert.equal(newPassValid, true, 'New password must be valid')
})

test('4. Existing admin -> idempotent result and password rotation', async () => {
  await cleanUsersAndRelated()

  // First upsert
  await safeUpsertAdmin({
    email: 'primary-admin@khatikhadyo.com',
    password: 'PasswordFirstRound1!',
    isProduction: false,
    dbClient: testDb,
  })

  // Second upsert with rotated password
  const result = await safeUpsertAdmin({
    email: 'primary-admin@khatikhadyo.com',
    password: 'PasswordSecondRound2!',
    isProduction: false,
    dbClient: testDb,
  })

  assert.equal(result.action, 'updated')

  const admin = await testDb.user.findUnique({ where: { email: 'primary-admin@khatikhadyo.com' } })
  const oldValid = await verifyPassword('PasswordFirstRound1!', admin.password)
  const newValid = await verifyPassword('PasswordSecondRound2!', admin.password)

  assert.equal(oldValid, false, 'Old password must no longer match')
  assert.equal(newValid, true, 'Rotated password must match')
  assert.equal(admin.role, 'admin')
})

test('5. Missing or invalid required inputs fail gracefully with clear errors', async () => {
  // Missing email
  await assert.rejects(
    () => safeUpsertAdmin({ email: '', password: 'Password123!', isProduction: false, dbClient: testDb }),
    /ADMIN_EMAIL is required/
  )

  // Invalid email
  await assert.rejects(
    () => safeUpsertAdmin({ email: 'not-an-email', password: 'Password123!', isProduction: false, dbClient: testDb }),
    /ADMIN_EMAIL must be a valid email address/
  )

  // Missing password
  await assert.rejects(
    () => safeUpsertAdmin({ email: 'admin@khatikhadyo.com', password: '', isProduction: false, dbClient: testDb }),
    /ADMIN_PASSWORD is required/
  )

  // Short password (< 8 chars)
  await assert.rejects(
    () => safeUpsertAdmin({ email: 'admin@khatikhadyo.com', password: 'short', isProduction: false, dbClient: testDb }),
    /ADMIN_PASSWORD must be at least 8 characters long/
  )
})

test('6. Production guard blocks execution without explicit confirmation flag', async () => {
  // In production without confirmation flag -> throws
  await assert.rejects(
    () =>
      safeUpsertAdmin({
        email: 'admin@khatikhadyo.com',
        password: 'ValidPassword123!',
        isProduction: true,
        confirmProduction: false,
        dbClient: testDb,
      }),
    /Execution blocked by production guard: CONFIRM_SAFE_ADMIN_UPSERT=true is required/
  )

  // In production WITH confirmation flag -> succeeds
  const res = await safeUpsertAdmin({
    email: 'admin@khatikhadyo.com',
    password: 'ValidPassword123!',
    isProduction: true,
    confirmProduction: true,
    dbClient: testDb,
  })

  assert.equal(res.success, true)
})

test('7. Absolute non-destructive guarantee: zero records deleted or truncated', async () => {
  await cleanUsersAndRelated()

  // Seed sample database entities
  const category = await testDb.category.create({
    data: { id: 'cat-keep', name: 'Raw Honey', slug: 'raw-honey' },
  })

  const product = await testDb.product.create({
    data: {
      id: 'prod-keep',
      name: 'Wild Forest Honey',
      slug: 'wild-forest-honey',
      price: 600,
      stock: 25,
      categoryId: category.id,
    },
  })

  const coupon = await testDb.coupon.create({
    data: {
      id: 'c-keep',
      code: 'KEEP10',
      value: 10,
      usedCount: 5,
      usageLimit: 100,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 100000),
      isActive: true,
    },
  })

  const existingCustomer = await testDb.user.create({
    data: {
      id: 'usr-customer-keep',
      email: 'customer-keep@khatikhadyo.com',
      password: 'hash',
      role: 'customer',
    },
  })

  const order = await testDb.order.create({
    data: {
      id: 'ord-keep',
      orderNumber: 'KK-KEEP-99',
      totalAmount: 1200,
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      orderStatus: 'delivered',
      userId: existingCustomer.id,
      items: {
        create: [
          {
            id: 'item-keep',
            productId: product.id,
            productName: product.name,
            quantity: 2,
            unit: 'jar',
            price: 600,
          },
        ],
      },
    },
  })

  // Record pre-execution counts
  const countCategoryPre = await testDb.category.count()
  const countProductPre = await testDb.product.count()
  const countCouponPre = await testDb.coupon.count()
  const countOrderPre = await testDb.order.count()
  const countOrderItemPre = await testDb.orderItem.count()
  const countUserPre = await testDb.user.count()

  // Execute safe admin upsert
  await safeUpsertAdmin({
    email: 'new-recovery-admin@khatikhadyo.com',
    password: 'BrandNewAdminPass2026!',
    isProduction: false,
    dbClient: testDb,
  })

  // Assert all existing operational records are 100% intact
  assert.equal(await testDb.category.count(), countCategoryPre, 'Category count must remain identical')
  assert.equal(await testDb.product.count(), countProductPre, 'Product count must remain identical')
  assert.equal(await testDb.coupon.count(), countCouponPre, 'Coupon count must remain identical')
  assert.equal(await testDb.order.count(), countOrderPre, 'Order count must remain identical')
  assert.equal(await testDb.orderItem.count(), countOrderItemPre, 'OrderItem count must remain identical')

  // User count increased by exactly 1 (the new admin)
  assert.equal(await testDb.user.count(), countUserPre + 1, 'Only 1 user record was added, none deleted')

  // Verify the customer user was not touched
  const customerPost = await testDb.user.findUnique({ where: { id: existingCustomer.id } })
  assert.equal(customerPost.role, 'customer', 'Customer role must remain untouched')
})
