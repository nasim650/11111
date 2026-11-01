import { db } from '@/lib/db'

export async function createAuditLog(
  params: {
    adminId?: string
    action: string
    module: string
    referenceId?: string
    oldData?: unknown
    newData?: unknown
    ipAddress?: string
    dbClient?: any
  },
  dbClientArg?: any
) {
  const client = params.dbClient || dbClientArg || db
  try {
    return await client.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        module: params.module,
        referenceId: params.referenceId,
        oldData: params.oldData ? JSON.stringify(params.oldData) : null,
        newData: params.newData ? JSON.stringify(params.newData) : null,
        ipAddress: params.ipAddress,
      },
    })
  } catch (err) {
    // Audit logging is best-effort — never fail the request because of it
    console.warn('[AuditLog] Failed to record audit log entry:', err)
  }
}
