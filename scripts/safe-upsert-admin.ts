import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export type SafeAdminUpsertOptions = {
  email?: string
  password?: string
  name?: string
  isProduction?: boolean
  confirmProduction?: boolean
  dbClient?: any
}

export type SafeAdminUpsertResult = {
  success: boolean
  action: 'created' | 'updated'
  maskedEmail: string
  role: string
  isActive: boolean
}

/**
 * Masks an email address for safe logging.
 * Example: admin@khatikhadyo.com -> a***n@khatikhadyo.com
 */
export function maskEmail(email: string): string {
  const parts = email.trim().toLowerCase().split('@')
  if (parts.length !== 2) return '***'
  const [local, domain] = parts
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`
}

/**
 * Safely upserts an admin account without executing destructive operations.
 * GUARANTEES:
 * 1. Zero deleteMany, truncate, or drop queries.
 * 2. Zero table resets or cascades.
 * 3. Never writes plaintext passwords to logs or database.
 * 4. Production guard blocks execution without explicit CONFIRM_SAFE_ADMIN_UPSERT=true.
 */
export async function safeUpsertAdmin(options: SafeAdminUpsertOptions): Promise<SafeAdminUpsertResult> {
  const client = options.dbClient || db

  const email = (options.email || process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = options.password || process.env.ADMIN_PASSWORD || ''
  const name = (options.name || process.env.ADMIN_NAME || '').trim() || undefined

  const isProduction =
    options.isProduction ??
    (process.env.NODE_ENV === 'production' ||
      process.env.VERCEL_ENV === 'production' ||
      process.env.APP_ENV === 'production')

  const confirmProduction =
    options.confirmProduction ??
    (process.env.CONFIRM_SAFE_ADMIN_UPSERT === 'true')

  // ── 1. VALIDATION CHECKS ───────────────────────────────────────────────────
  if (!email) {
    throw new Error('ADMIN_EMAIL is required.')
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.')
  }

  if (!password) {
    throw new Error('ADMIN_PASSWORD is required.')
  }

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters long.')
  }

  // ── 2. PRODUCTION GUARD ───────────────────────────────────────────────────
  if (isProduction && !confirmProduction) {
    throw new Error(
      'Execution blocked by production guard: CONFIRM_SAFE_ADMIN_UPSERT=true is required in production environment.'
    )
  }

  // ── 3. HASH PASSWORD ───────────────────────────────────────────────────────
  // Uses existing auth standard (bcrypt with 12 rounds)
  const hashedPassword = await hashPassword(password)

  // ── 4. NON-DESTRUCTIVE UPSERT ─────────────────────────────────────────────
  const existingUser = await client.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  })

  let action: 'created' | 'updated'

  if (!existingUser) {
    await client.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || 'Administrator',
        role: 'admin',
        isActive: true,
        isVerified: true,
        sessionVersion: 1,
      },
    })
    action = 'created'
  } else {
    await client.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        isVerified: true,
        ...(name ? { name } : {}),
        sessionVersion: { increment: 1 }, // Invalidate prior sessions
      },
    })
    action = 'updated'
  }

  // ── 5. OPTIONAL AUDIT LOG ─────────────────────────────────────────────────
  try {
    await client.auditLog.create({
      data: {
        action: `ADMIN_ACCOUNT_${action.toUpperCase()}`,
        module: 'auth',
        referenceId: existingUser?.id || undefined,
        newData: JSON.stringify({
          maskedEmail: maskEmail(email),
          action,
          role: 'admin',
          timestamp: new Date().toISOString(),
        }),
      },
    })
  } catch (err) {
    // Non-fatal if audit logging fails
  }

  return {
    success: true,
    action,
    maskedEmail: maskEmail(email),
    role: 'admin',
    isActive: true,
  }
}

async function main() {
  const result = await safeUpsertAdmin({})
  console.log('---------------------------------------------------------')
  console.log('✅ Safe Admin Account Recovery Succeeded')
  console.log(`Action: ${result.action.toUpperCase()}`)
  console.log(`Target: ${result.maskedEmail}`)
  console.log(`Role: ${result.role}`)
  console.log(`Active: ${result.isActive}`)
  console.log('---------------------------------------------------------')
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().catch((err: any) => {
    console.error('❌ Safe Admin Upsert Failed:', err?.message || err)
    process.exit(1)
  })
}
