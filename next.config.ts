import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block the page from being embedded in iframes (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Stop the browser leaking the full URL as Referer to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser features we don't use
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Force HTTPS for 1 year, include subdomains
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Basic CSP — allows Google APIs needed for OAuth + the app itself.
  // Scripts: self + Google accounts (OAuth redirect)
  // Styles: self + unsafe-inline (required by Tailwind's runtime CSS injection)
  // Frames: none (app never iframes anything)
  // Connect: self + googleapis for any client-side API calls
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // unsafe-inline required for Next.js hydration bootstrap scripts
      "script-src 'self' 'unsafe-inline' https://accounts.google.com",
      "style-src 'self'",
      "img-src 'self' data: https://lh3.googleusercontent.com",
      "font-src 'self'",
      "frame-src https://accounts.google.com",
      "connect-src 'self' https://www.googleapis.com",
      "frame-ancestors 'none'",
      // Restrict where forms can submit — only this origin and Google OAuth
      "form-action 'self' https://accounts.google.com",
    ].join("; "),
  },
  // Prevent other sites sharing a browsing context with this app (Spectre mitig.)
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Prevent other origins from loading this app's resources without explicit opt-in
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
]

const nextConfig: NextConfig = {
  // Hide the X-Powered-By: Next.js header (information disclosure)
  poweredByHeader: false,
  allowedDevOrigins: ["app.discoveryco.me"],
  async headers() {
    return [
      {
        // Apply security headers to every route
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/billing",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
