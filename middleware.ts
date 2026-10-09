import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// sonner 2.0.7. See the style-src comment below for what these are and how to
// regenerate them.
const SONNER_STYLE_HASHES = [
  "sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=",
  "sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY=",
]

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
    // Stylesheets are same-origin only. The two hashes are sonner's, which
    // injects its CSS into a <style> element at import time and has no nonce
    // option: first an empty element (the hash of the empty string), then the
    // CSS text node. app/layout.tsx imports sonner/dist/styles.css, so the
    // toast styles do not depend on these hashes; they only keep the blocked
    // injection from logging a CSP violation on every page load. A sonner
    // upgrade changes the second hash and the warning comes back, harmlessly.
    // Regenerate with:
    //   node -e "const s=require('fs').readFileSync('node_modules/sonner/dist/index.mjs','utf8');const i=s.indexOf('__insertCSS(\"')+12;let j=i+1;while(s[j]!=='\"'){j+=s[j]==='\\\\'?2:1}console.log(require('crypto').createHash('sha256').update(JSON.parse(s.slice(i,j+1))).digest('base64'))"
    `style-src 'self' ${SONNER_STYLE_HASHES.map((h) => `'${h}'`).join(" ")}`,
    "img-src 'self' data: https://lh3.googleusercontent.com",
    "font-src 'self'",
    "frame-src https://accounts.google.com",
    `connect-src 'self' https://www.googleapis.com ${process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"}`,
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
  // lh3.googleusercontent.com (Google avatars) returns CORP: cross-origin
  // so require-corp is safe — cross-origin resources that don't opt in are blocked
  response.headers.set("Cross-Origin-Embedder-Policy", "require-corp")

  return response
}

export const config = {
  matcher: "/:path*",
}
