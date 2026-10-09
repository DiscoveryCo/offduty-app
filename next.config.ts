import type { NextConfig } from "next";

// Security headers are set dynamically in middleware.ts so that the CSP can
// include a per-request nonce. Do not add a static CSP here — it would
// override the nonce-based one from middleware and break script execution.

const nextConfig: NextConfig = {
  // Hide the X-Powered-By: Next.js header (information disclosure)
  poweredByHeader: false,
  allowedDevOrigins: ["app.discoveryco.me"],
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // Assets go through eu.i.posthog.com, not the eu-assets.i.posthog.com
      // host PostHog's docs suggest. Proxying to eu-assets from Railway's
      // lhr1 edge returns Cloudflare error 1000 ("DNS points to prohibited
      // IP"), so recorder.js 403s and session replay never starts, while
      // ingestion keeps working. eu.i.posthog.com serves the same
      // /static and /array paths and proxies fine.
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
    ]
  },
  async headers() {
    return [
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
