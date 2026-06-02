import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Generate a unique nonce for this request. Next.js reads the x-nonce
  // request header during SSR and applies it to its own generated inline
  // scripts, letting us use 'nonce-...' instead of 'unsafe-inline'.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")

  const csp = [
    "default-src 'self'",
    // 'nonce-...' allows only scripts carrying this nonce.
    // 'strict-dynamic' propagates that trust to scripts they load,
    // covering Next.js's dynamically injected chunks.
    // 'self' + accounts.google.com are kept as fallbacks for older browsers
    // that don't support strict-dynamic.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://accounts.google.com`,
    "style-src 'self'",
    "img-src 'self' data: https://lh3.googleusercontent.com",
    "font-src 'self'",
    "frame-src https://accounts.google.com",
    "connect-src 'self' https://www.googleapis.com",
    "frame-ancestors 'none'",
    "form-action 'self' https://accounts.google.com",
  ].join("; ")

  // Forward the nonce to Next.js so it can stamp it onto inline scripts
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Security headers — applied to every response including static assets
  response.headers.set("Content-Security-Policy", csp)
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin")
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin")

  return response
}

export const config = {
  matcher: "/:path*",
}
