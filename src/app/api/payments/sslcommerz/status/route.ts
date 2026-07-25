import { NextResponse } from 'next/server'
import { getSSLCommerzEnvStatus, getSSLCommerzConfig } from '@/lib/sslcommerz'
import { getUserRoleFromRequest, isAdmin } from '@/lib/utils'

// GET /api/payments/sslcommerz/status
// Admin-only health check: reports which SSLCommerz env vars are configured
// and whether the integration is production-ready. Does NOT expose secret
// values — only presence/absence and the active mode.
export async function GET(request: Request) {
  const role = await getUserRoleFromRequest(request as never)
  if (!isAdmin(role)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: admin access required' },
      { status: 403 }
    )
  }

  const envStatus = getSSLCommerzEnvStatus()
  const config = await getSSLCommerzConfig()

  return NextResponse.json({
    success: true,
    data: {
      envConfigured: envStatus.configured,
      mode: envStatus.mode,
      credentialsPresent: Boolean(config),
      presentVars: envStatus.present,
      missingVars: envStatus.missing,
      baseUrl: config?.baseUrl || null,
      // Never expose store_id or store_password — only whether they're set.
    },
  })
}
