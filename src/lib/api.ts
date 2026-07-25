/**
 * API response extraction helpers
 *
 * API returns two formats:
 * 1. Paginated: { success: true, data: { data: [...], pagination: {...} } }
 * 2. Non-paginated: { success: true, data: [...] } or { success: true, data: <object> }
 */

/**
 * Extract items array from API response
 * Handles both paginated and non-paginated response formats
 */
export function extractItems<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response
  if (!response || typeof response !== 'object') return []

  const obj = response as Record<string, unknown>

  // Check for { success: true, data: { data: [...], pagination: {...} } }
  if (obj.data) {
    if (Array.isArray(obj.data)) return obj.data as T[]

    const dataObj = obj.data as Record<string, unknown>
    // Paginated response: data.data is the items array
    if (dataObj.data && Array.isArray(dataObj.data)) return dataObj.data as T[]
    // Fallback: data.items
    if (dataObj.items && Array.isArray(dataObj.items)) return dataObj.items as T[]
  }

  // Direct items property
  if (obj.items && Array.isArray(obj.items)) return obj.items as T[]

  return []
}

/**
 * Extract pagination info from API response
 */
export function extractPagination(response: unknown): {
  page: number
  limit: number
  total: number
  totalPages: number
} {
  const defaultPagination = { page: 1, limit: 10, total: 0, totalPages: 0 }

  if (!response || typeof response !== 'object') return defaultPagination

  const obj = response as Record<string, unknown>

  // Check for { success: true, data: { pagination: {...} } }
  if (obj.data && typeof obj.data === 'object') {
    const dataObj = obj.data as Record<string, unknown>
    if (dataObj.pagination && typeof dataObj.pagination === 'object') {
      return dataObj.pagination as typeof defaultPagination
    }
  }

  // Direct pagination property
  if (obj.pagination && typeof obj.pagination === 'object') {
    return obj.pagination as typeof defaultPagination
  }

  return defaultPagination
}

// ─── Authenticated fetch helpers ───────────────────────────────────────────
// Admin write operations (POST/PUT/DELETE) and uploads require a Bearer JWT.
// Previously admin pages called fetch() without the Authorization header, so
// every create/update/delete/upload returned 401/403 — the root cause of the
// "upload doesn't create a banner" bug.
//
// The token is read directly from localStorage (where the Zustand persist
// middleware stores it under the "kk-app-store" key) to avoid a circular
// import between api.ts and store.ts.

function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('kk-app-store')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Zustand persist wraps state in { state: {...}, version: N }
    const state = parsed?.state ?? parsed
    return state?.accessToken ?? null
  } catch {
    return null
  }
}

/**
 * Build headers with the auth token attached. Merges with any caller headers.
 * For multipart/form-data uploads, do NOT set Content-Type (browser sets boundary).
 */
export function authHeaders(
  extra: Record<string, string> = {}
): Record<string, string> {
  const token = readAccessToken()
  const headers: Record<string, string> = { ...extra }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

/**
 * fetch() wrapper that automatically attaches the JWT Authorization header.
 * Use for any admin/authenticated API call (writes, uploads, protected reads).
 */
export function authFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = authHeaders(
    (init.headers as Record<string, string> | undefined) ?? {}
  )
  return fetch(input, { ...init, headers })
}
