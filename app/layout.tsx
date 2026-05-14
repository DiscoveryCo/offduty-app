import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})

export const metadata: Metadata = {
  title: "DiscoveryMail",
  description: "Batch your Gmail inbox on your schedule",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="min-h-screen bg-background text-foreground">
        {children}
        <Toaster richColors position="top-left" offset={{ top: 68, left: 16 }} />
      </body>
    </html>
  )
}
