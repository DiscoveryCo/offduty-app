import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { headers } from "next/headers"
import "./globals.css"
// sonner ships its CSS twice: as this stylesheet, and as a string it injects
// into a <style> element at import time. The CSP sets style-src 'self', which
// blocks the injected one, so without this import every toast renders
// unstyled. Importing it means the styles arrive as a same-origin stylesheet
// instead. The injection still happens and is still blocked, which is
// harmless but does log a CSP violation on every page load.
import "sonner/dist/styles.css"
import { Toaster } from "sonner"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})

export const metadata: Metadata = {
  title: "offduty",
  description: "Batch your Gmail inbox on your schedule",
  icons: { icon: "/favicon.png" },
  formatDetection: { email: false, telephone: false, address: false },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the nonce injected by middleware so it can be forwarded to any
  // explicit <Script> components added in future. Next.js also reads x-nonce
  // internally to stamp its own generated inline scripts.
  const nonce = (await headers()).get("x-nonce") ?? undefined

  return (
    <html lang="en" className={geist.variable}>
      <body className="min-h-screen bg-background text-foreground" {...(nonce ? { nonce } : {})}>
        {children}
        <Toaster richColors position="top-left" offset={{ top: 68, left: 16 }} />
      </body>
    </html>
  )
}
