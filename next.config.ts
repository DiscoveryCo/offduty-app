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
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/array/:path*", destination: "https://eu-assets.i.posthog.com/array/:path*" },
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
