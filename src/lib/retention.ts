import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'

export interface RetentionJobResult {
  dryRun: boolean
  cutoffDate: string
  expiredOtpChallengesCleaned: number
  guestOrdersAnonymized: number
  hardDeleteEnabled: boolean
  hardDeletedRecordsCount: number
  executedAt: string
}

/**
 * Universal Data Retention & Privacy Anonymization Policy (Phase 1B.3)
 *
 * Rules:
 * 1. Financial, order, payment, and audit records are NEVER hard-deleted by default.
 * 2. Hard deletion is strictly guarded by RETENTION_HARD_DELETE_ENABLED=false.
 * 3. Expired OTP challenges older than the cutoff (180 days) are safely purged.
 * 4. Guest orders older than 180 days have personal identifying information (PII) anonymized:
 *    - guestName -> 'Guest Customer'
 *    - guestPhone -> masked format
 *    - guestEmail -> null
 *    - guestAccessTokenHash -> null
 *    - Order number, total, payment status, inventory, and items remain intact.
 * 5. Dry-run mode is enabled by default to preview affected record counts safely.
 */
export async function executeRetentionJob(options: {
  dryRun?: boolean
  daysOld?: number
  dbClient?: any
} = {}): Promise<RetentionJobResult> {
  const prisma = options.dbClient || db
  const dryRun = options.dryRun !== false // Default to dryRun: true for absolute safety
  const daysOld = options.daysOld || 180 // Standard 6-month window (180 days)
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

  const hardDeleteEnabled = process.env.RETENTION_HARD_DELETE_ENABLED === 'true'

  // 1. Identify Expired OTP Challenges older than cutoff
  const eligibleOtpCount = await prisma.otpChallenge.count({
    where: {
      OR: [
        { expiresAt: { lt: cutoffDate } },
        { consumedAt: { not: null, lt: cutoffDate } },
      ],
    },
  })

  // 2. Identify Guest Orders older than cutoff with non-anonymized PII
  const eligibleGuestOrders = await prisma.order.findMany({
    where: {
      createdAt: { lt: cutoffDate },
      userId: null,
      OR: [
        { guestEmail: { not: null } },
        {
          AND: [
            { guestPhone: { not: null } },
            { guestPhone: { not: 'ANONYMIZED' } },
          ],
        },
        { guestAccessTokenHash: { not: null } },
      ],
    },
    select: {
      id: true,
      guestPhone: true,
      guestAddress: true,
    },
  })

  const guestOrdersCount = eligibleGuestOrders.length

  if (dryRun) {
    return {
      dryRun: true,
      cutoffDate: cutoffDate.toISOString(),
      expiredOtpChallengesCleaned: eligibleOtpCount,
      guestOrdersAnonymized: guestOrdersCount,
      hardDeleteEnabled,
      hardDeletedRecordsCount: 0,
      executedAt: new Date().toISOString(),
    }
  }

  // Live Execution (dryRun === false)
  // Step A: Purge expired OTP challenges older than cutoff
  let deletedOtpCount = 0
  if (eligibleOtpCount > 0) {
    const deleteRes = await prisma.otpChallenge.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoffDate } },
          { consumedAt: { not: null, lt: cutoffDate } },
        ],
      },
    })
    deletedOtpCount = deleteRes.count
  }

  // Step B: Anonymize Guest Orders older than cutoff
  let anonymizedCount = 0
  for (const order of eligibleGuestOrders) {
    // Mask phone number: preserve prefix and last 2 digits, mask middle
    let maskedPhone = 'ANONYMIZED'
    if (order.guestPhone && order.guestPhone.length >= 7) {
      maskedPhone = order.guestPhone.slice(0, 3) + '****' + order.guestPhone.slice(-2)
    }

    // Retain only broad city/district if present, remove specific street/house details
    let maskedAddress: string | null = null
    if (order.guestAddress) {
      if (order.guestAddress.includes('__BDMETA__')) {
        maskedAddress = 'Bangladesh (City retained for delivery analytics)'
      } else {
        const parts = order.guestAddress.split(',')
        maskedAddress = parts[parts.length - 1]?.trim() || 'Bangladesh'
      }
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        guestName: 'Guest Customer',
        guestPhone: maskedPhone,
        guestEmail: null,
        guestAddress: maskedAddress,
        guestAccessTokenHash: null,
        guestAccessExpiresAt: null,
      },
    })
    anonymizedCount++
  }

  // Step C: Log audit summary
  await createAuditLog({
    action: 'retention_cleanup_executed',
    module: 'retention',
    referenceId: `retention-${Date.now()}`,
    newData: {
      cutoffDate: cutoffDate.toISOString(),
      otpChallengesCleaned: deletedOtpCount,
      guestOrdersAnonymized: anonymizedCount,
      hardDeleteEnabled,
    },
  }, prisma).catch(() => {})

  return {
    dryRun: false,
    cutoffDate: cutoffDate.toISOString(),
    expiredOtpChallengesCleaned: deletedOtpCount,
    guestOrdersAnonymized: anonymizedCount,
    hardDeleteEnabled,
    hardDeletedRecordsCount: 0,
    executedAt: new Date().toISOString(),
  }
}
