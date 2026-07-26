import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Next.js 16 renamed the `middleware` file convention to `proxy`.
export function proxy(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  // NOTE: X-Frame-Options and frame-ancestors are relaxed to allow the
  // Preview Panel (which uses an iframe) to embed the app during development.
  // In production, set X-Frame-Options to DENY and frame-ancestors to 'none'.
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  // connect-src allows self + https (for Cloudinary images / payment gateways) + dev websocket
  // frame-ancestors 'self' allows the Preview Panel iframe to embed the page
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss: ws:; frame-ancestors 'self';"
  )
  // HSTS only in production (requires HTTPS)
  if (request.nextUrl.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
