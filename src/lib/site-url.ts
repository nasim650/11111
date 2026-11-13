/**
 * Safe Base URL helper for SEO, metadataBase, canonical links, and sitemaps.
 *
 * PREVIEW VS PRODUCTION BEHAVIOR:
 * 1. Explicit Domain: If NEXT_PUBLIC_APP_URL is set (e.g. in Vercel Production or local .env),
 *    it takes precedence.
 * 2. Vercel Preview Auto-Detection: In Vercel Preview environments, VERCEL_URL is automatically
 *    injected by Vercel (e.g. "11111-4112ed511-dorim.vercel.app"). Using https://${VERCEL_URL}
 *    ensures social preview cards, OpenGraph tags, and canonical references resolve to the
 *    preview deployment rather than pointing prematurely to production.
 * 3. Local Development Fallback: In development or when unconfigured, falls back to http://localhost:3000.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.trim()}`
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://khatikhadyo.com'
  }
  return 'http://localhost:3000'
}
