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

test('2. Missing CONFIRM_SAFE_ADMIN_UPSERT guard blocks execution in all environments', async () => {
  await assert.rejects(
    () =>
      safeUpsertAdmin({
        email: 'admin@khatikhadyo.com',
        confirmEmail: 'admin@khatikhadyo.com',
        password: 'ValidPassword123!',
        confirmSafe: false,
        dbClient: testDb,
      }),
    /Execution blocked: CONFIRM_SAFE_ADMIN_UPSERT=true is mandatory in all environments/
  )
})

test('3. Missing or mismatched CONFIRM_ADMIN_EMAIL blocks execution before DB queries', async () => {
  // Missing confirmEmail
  await assert.rejects(
    () =>
      safeUpsertAdmin({
        email: 'admin@khatikhadyo.com',
        confirmEmail: '',
        password: 'ValidPassword123!',
        confirmSafe: true,
        dbClient: testDb,
      }),
    /CONFIRM_ADMIN_EMAIL is required/
  )

  // Mismatched confirmEmail
  await assert.rejects(
    () =>
      safeUpsertAdmin({
        email: 'admin@khatikhadyo.com',
        confirmEmail: 'different@khatikhadyo.com',
        password: 'ValidPassword123!',
        confirmSafe: true,
        dbClient: testDb,
      }),
    /Target confirmation failed: ADMIN_EMAIL and CONFIRM_ADMIN_EMAIL do not match/
  )
})

test('4. Password validation: requires minimum 12 characters', async () => {
  await assert.rejects(
    () =>
      safeUpsertAdmin({
        email: 'admin@khatikhadyo.com',
        confirmEmail: 'admin@khatikhadyo.com',
        password: 'Short12345!', // 11 characters
        confirmSafe: true,
        dbClient: testDb,
      }),
    /ADMIN_PASSWORD must be at least 12 characters long/
  )
})

test('5. Atomic create: new user and audit log created in same transaction', async () => {
  await cleanUsersAndRelated()

  const result = await safeUpsertAdmin({
    email: 'newadmin@khatikhadyo.com',
    confirmEmail: 'newadmin@khatikhadyo.com',
    password: 'StrongAdminPass123!',
    name: 'Super Admin',
    confirmSafe: true,
    dbClient: testDb,
  })

  assert.equal(result.success, true)
  assert.equal(result.action, 'created')
  assert.equal(result.maskedEmail, 'n***n@khatikhadyo.com')
  assert.equal(result.role, 'admin')
  assert.equal(result.isActive, true)

  const user = await testDb.user.findUnique({ where: { email: 'newadmin@khatikhadyo.com' } })
  assert.ok(user, 'User must exist in database')
  assert.equal(user.role, 'admin')
  assert.equal(user.isActive, true)
  assert.equal(user.isVerified, true)
  assert.equal(user.name, 'Super Admin')
  assert.equal(user.sessionVersion, 1)

  // Plaintext password must never be stored
  assert.notEqual(user.password, 'StrongAdminPass123!')
  const passwordValid = await verifyPassword('StrongAdminPass123!', user.password)
  assert.equal(passwordValid, true, 'Stored password must match bcrypt hash')

  // Verify AuditLog record in same transaction
  const audit = await testDb.auditLog.findFirst({
    where: { action: 'ADMIN_ACCOUNT_CREATED', referenceId: user.id },
  })
  assert.ok(audit, 'Audit log entry must exist')
  assert.equal(audit.module, 'auth')
  const details = JSON.parse(audit.newData || '{}')
  assert.equal(details.maskedEmail, 'n***n@khatikhadyo.com')
  assert.equal(details.action, 'created')
  assert.equal(details.role, 'admin')
})

test('6. Atomic update: promotes user, updates password, increments sessionVersion, and creates audit log', async () => {
  await cleanUsersAndRelated()

  const existingCustomer = await testDb.user.create({
    data: {
      email: 'customer@khatikhadyo.com',
      password: 'OldCustomerPassword123!',
      name: 'Regular Customer',
      role: 'customer',
      isActive: false,
      isVerified: false,
      sessionVersion: 1,
    },
  })

  const result = await safeUpsertAdmin({
    email: 'customer@khatikhadyo.com',
    confirmEmail: 'customer@khatikhadyo.com',
    password: 'NewAdminSecurePassword999!',
    confirmSafe: true,
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
  assert.equal(updated.sessionVersion, 2, 'Session version must be incremented to revoke prior tokens')

  const newPassValid = await verifyPassword('NewAdminSecurePassword999!', updated.password)
  assert.equal(newPassValid, true, 'New password must match bcrypt hash')

  const audit = await testDb.auditLog.findFirst({
    where: { action: 'ADMIN_ACCOUNT_UPDATED', referenceId: existingCustomer.id },
  })
  assert.ok(audit, 'Audit log entry must exist for update')
})

test('7. Audit failure rolls back user mutation completely (transaction atomicity)', async () => {
  await cleanUsersAndRelated()

  // Seed an existing user
  const originalUser = await testDb.user.create({
    data: {
      email: 'test-rollback@khatikhadyo.com',
      password: 'OriginalPassword123!',
      role: 'customer',
      sessionVersion: 1,
    },
  })

  // Create a database client proxy where auditLog.create fails intentionally inside the transaction
  const failingDbClient = {
    ...testDb,
    $transaction: async (fn) => {
      return testDb.$transaction(async (tx) => {
        const proxiedTx = {
          ...tx,
          auditLog: {
            create: async () => {
              throw new Error('SIMULATED_AUDIT_LOG_DATABASE_FAILURE')
            },
          },
        }
        return fn(proxiedTx)
      })
    },
  }

  // Expect safeUpsertAdmin to fail because audit logging failed
  await assert.rejects(
    () =>
      safeUpsertAdmin({
        email: 'test-rollback@khatikhadyo.com',
        confirmEmail: 'test-rollback@khatikhadyo.com',
        password: 'AttemptedNewPassword123!',
        confirmSafe: true,
        dbClient: failingDbClient,
      }),
    /SIMULATED_AUDIT_LOG_DATABASE_FAILURE/
  )

  // Verify rollback: user role and password did NOT change in database!
  const userAfterFailure = await testDb.user.findUnique({ where: { id: originalUser.id } })
  assert.equal(userAfterFailure.role, 'customer', 'User role must NOT have changed')
  assert.equal(userAfterFailure.password, 'OriginalPassword123!', 'Password must NOT have changed')
  assert.equal(userAfterFailure.sessionVersion, 1, 'sessionVersion must NOT have incremented')
})

test('8. Absolute non-destructive guarantee: zero records deleted or truncated', async () => {
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

  await testDb.order.create({
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

  const countCategoryPre = await testDb.category.count()
  const countProductPre = await testDb.product.count()
  const countCouponPre = await testDb.coupon.count()
  const countOrderPre = await testDb.order.count()
  const countOrderItemPre = await testDb.orderItem.count()
  const countUserPre = await testDb.user.count()

  // Execute safe admin upsert
  await safeUpsertAdmin({
    email: 'new-recovery-admin@khatikhadyo.com',
    confirmEmail: 'new-recovery-admin@khatikhadyo.com',
    password: 'BrandNewAdminPass2026!',
    confirmSafe: true,
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

  const customerPost = await testDb.user.findUnique({ where: { id: existingCustomer.id } })
  assert.equal(customerPost.role, 'customer', 'Customer role must remain untouched')
})

test.after(async () => {
  await testDb.$disconnect()
})

