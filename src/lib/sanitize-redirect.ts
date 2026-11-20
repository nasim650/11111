/**
 * Strict Internal Redirect Sanitizer
 * Allows ONLY valid relative paths starting with a single '/' (e.g. '/orders/ORD-123').
 * Strictly rejects protocol-relative URLs (//evil.com), backslash tricks (/\evil.com, /\\evil.com),
 * external absolute URLs (https://...), javascript: schemes, control chars, and CRLF injection.
 */
export function sanitizeInternalRedirect(
  target: string | null | undefined,
  fallback: string = '/'
): string {
  if (!target || typeof target !== 'string') return fallback

  const clean = target.trim()
  if (!clean) return fallback

  // Reject CRLF and control characters
  if (/[\r\n\0\t]/.test(clean)) return fallback

  // Must begin with a single slash, not followed by another slash or backslash
  if (!clean.startsWith('/') || clean.startsWith('//') || clean.startsWith('/\\') || clean.startsWith('\\')) {
    return fallback
  }

  // Must not contain backslashes anywhere in the path
  if (clean.includes('\\')) {
    return fallback
  }

  try {
    // Parse against a dummy base origin to verify hostname/protocol cannot be spoofed
    const parsed = new URL(clean, 'http://localhost')
    if (parsed.origin !== 'http://localhost' || parsed.protocol !== 'http:') {
      return fallback
    }

    // Ensure pathname begins with '/'
    if (!parsed.pathname.startsWith('/')) {
      return fallback
    }

    // Return the safe internal pathname + search + hash
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
