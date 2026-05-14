import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { Mail, ArrowLeft, ShieldCheck } from "lucide-react"

export default async function ConnectInboxPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  return (
    <div className="min-h-screen bg-[#F2F0EE] flex flex-col">
      <header className="bg-[#FFFDFB] border-b border-[#D1D0D0] px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-[#4D4D4D] hover:text-[#4D4D4D]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-75 transition-opacity">
          <Mail className="w-5 h-5 text-[#A78BFA]" />
          <span className="font-bold text-lg tracking-tight text-[#161616]">DiscoveryMail</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full bg-[#FFFDFB] rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-[#D1D0D0] p-8">
          <div className="flex items-center justify-center w-12 h-12 bg-[#f0f0ff] rounded-xl mb-6">
            <ShieldCheck className="w-6 h-6 text-[#A78BFA]" />
          </div>

          <h1 className="text-xl font-bold text-[#161616] mb-2">Connect another inbox</h1>
          <p className="text-sm text-[#4D4D4D] mb-6">
            DiscoveryMail will request permission to manage your Gmail inbox. This allows it to hold and release emails on a schedule.
          </p>

          <ul className="space-y-3 mb-8">
            {[
              "Read and modify your emails",
              "Create a label to hold emails",
              "Receive notifications when new emails arrive",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-[#161616]">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-[#A78BFA] flex-shrink-0 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>

          <p className="text-xs text-[#4D4D4D] mb-6">
            DiscoveryMail only uses these permissions to batch your email. Your data is never shared.
          </p>

          <a
            href="/api/connect-inbox"
            className="w-full flex items-center justify-center gap-2 bg-[#A78BFA] hover:bg-[#8B5CF6] text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors"
          >
            Continue with Google
          </a>

          <Link
            href="/dashboard"
            className="mt-3 w-full flex items-center justify-center text-sm text-[#4D4D4D] hover:text-[#161616] py-2"
          >
            Cancel
          </Link>
        </div>
      </main>
    </div>
  )
}
