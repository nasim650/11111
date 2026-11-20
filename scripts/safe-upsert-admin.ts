import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export type SafeAdminUpsertOptions = {
  email?: string
  confirmEmail?: string
  password?: string
  name?: string
  confirmSafe?: boolean
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
 * Safely creates or updates an admin account without executing destructive operations.
 *
 * SECURITY & DATA SAFETY GUARANTEES:
 * 1. MANDATORY CONFIRMATION GUARD: CONFIRM_SAFE_ADMIN_UPSERT=true is required in all environments.
 * 2. TARGET MATCH CONFIRMATION: ADMIN_EMAIL must match CONFIRM_ADMIN_EMAIL exactly before executing any query.
 * 3. TRANSACTION ATOMICITY: User mutation and AuditLog creation are bound inside a single transaction.
 * 4. AUDIT ROLLBACK: If audit logging fails, the transaction rolls back completely (no partial updates).
 * 5. STRICT INPUT VALIDATION: Minimum password length is 12 characters.
 * 6. ZERO DESTRUCTIVE QUERIES: No deleteMany, truncate, drop, or cascade operations.
 * 7. ZERO LOG LEAKAGE: Never logs plaintext passwords, tokens, database URLs, or full email addresses.
 */
export async function safeUpsertAdmin(options: SafeAdminUpsertOptions = {}): Promise<SafeAdminUpsertResult> {
  const client = options.dbClient || db

  // ── 1. CONFIRMATION GUARDS (Checked BEFORE any DB connection or query) ──────
  const confirmSafe =
    options.confirmSafe ??
    (process.env.CONFIRM_SAFE_ADMIN_UPSERT === 'true')

  if (!confirmSafe) {
    throw new Error(
      'Execution blocked: CONFIRM_SAFE_ADMIN_UPSERT=true is mandatory in all environments to prevent accidental execution.'
    )
  }

  const email = (options.email || process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const confirmEmail = (options.confirmEmail || process.env.CONFIRM_ADMIN_EMAIL || '').trim().toLowerCase()
  const password = options.password || process.env.ADMIN_PASSWORD || ''
  const name = (options.name || process.env.ADMIN_NAME || '').trim() || undefined

  if (!email) {
    throw new Error('ADMIN_EMAIL is required.')
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.')
  }

  if (!confirmEmail) {
    throw new Error('CONFIRM_ADMIN_EMAIL is required.')
  }

  if (email !== confirmEmail) {
    throw new Error('Target confirmation failed: ADMIN_EMAIL and CONFIRM_ADMIN_EMAIL do not match.')
  }

  if (!password) {
    throw new Error('ADMIN_PASSWORD is required.')
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters long.')
  }

  // ── 2. HASH PASSWORD ───────────────────────────────────────────────────────
  // Uses existing auth standard (bcrypt with 12 rounds)
  const hashedPassword = await hashPassword(password)

  // ── 3. ATOMIC TRANSACTION BOUNDARY ─────────────────────────────────────────
  // Both user mutation and audit log creation run within the exact same transaction.
  // If audit logging fails, the entire transaction rolls back cleanly.
  const result = await client.$transaction(async (tx: any) => {
    const existingUser = await tx.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    })

    let action: 'created' | 'updated'
    let targetUserId: string

    if (!existingUser) {
      const createdUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || 'Administrator',
          role: 'admin',
          isActive: true,
          isVerified: true,
          sessionVersion: 1,
        },
        select: { id: true },
      })
      action = 'created'
      targetUserId = createdUser.id
    } else {
      const updatedUser = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          role: 'admin',
          isActive: true,
          isVerified: true,
          ...(name ? { name } : {}),
          sessionVersion: { increment: 1 }, // Invalidate prior sessions
        },
        select: { id: true },
      })
      action = 'updated'
      targetUserId = updatedUser.id
    }

    // Security-sensitive audit log in the same transaction boundary.
    // If audit logging fails, the transaction rolls back and no user change is committed.
    await tx.auditLog.create({
      data: {
        action: `ADMIN_ACCOUNT_${action.toUpperCase()}`,
        module: 'auth',
        referenceId: targetUserId,
        newData: JSON.stringify({
          maskedEmail: maskEmail(email),
          action,
          role: 'admin',
          timestamp: new Date().toISOString(),
        }),
      },
    })

    return {
      success: true,
      action,
      maskedEmail: maskEmail(email),
      role: 'admin',
      isActive: true,
    }
  })

  return result
}

async function main() {
  const result = await safeUpsertAdmin()
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
