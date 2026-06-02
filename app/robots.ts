import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/dashboard", "/settings", "/account", "/billing", "/connect-inbox", "/api/"],
    },
    host: "https://app.offduty.me",
  }
}
