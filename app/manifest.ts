import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "offduty",
    short_name: "offduty",
    description: "Batch your Gmail inbox on your schedule",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#A78BFA",
    icons: [
      {
        src: "/favicon.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  }
}
