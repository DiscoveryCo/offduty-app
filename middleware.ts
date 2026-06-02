import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Security headers that next.config.ts cannot apply to static files
// (/_next/static/*, /public/* assets like favicon, robots.txt, sitemap.xml).
// next.config.ts headers() only covers routed responses; middleware runs for
// every request including the static file server, closing that gap.
const STATIC_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "strict-origin-when-cross-origin",
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Apply headers to every response. For HTML pages these are already set by
  // next.config.ts — setting them again here is harmless (same values).
  for (const [key, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }

  return response
}

// Run on all paths including static assets.
export const config = {
  matcher: "/:path*",
}
