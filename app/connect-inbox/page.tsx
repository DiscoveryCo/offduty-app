import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ArrowLeft, ShieldCheck, AlertCircle } from "lucide-react"

export default async function ConnectInboxPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { inboxes: { select: { id: true } } },
  })
  if (!user) redirect("/login")

  const isSubscribed = user.subscriptionStatus === "active"
  const showBillingWarning = isSubscribed && user.inboxes.length > 0

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-[#4D4D4D] hover:text-[#4D4D4D]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-75 transition-opacity">
          <img src="/offduty-icon.svg" alt="" className="h-7 w-7" />
          <span className="font-bold text-lg text-[#161616]" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>offduty</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#E5E7EB] p-8">
          <div className="flex items-center justify-center w-12 h-12 bg-[#f0f0ff] rounded-xl mb-6">
            <ShieldCheck className="w-6 h-6 text-[#A78BFA]" />
          </div>

          <h1 className="text-xl font-bold text-[#161616] mb-2">Connect another inbox</h1>
          <p className="text-sm text-[#4D4D4D] mb-6">
            Offduty will request permission to manage your Gmail inbox. This allows it to hold and release emails on a schedule.
          </p>

          {showBillingWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Adding this inbox will add <strong>$3.49/mo</strong> (or <strong>$33.59/yr</strong> on annual) — a 30% discount for additional inboxes — billed immediately with proration.
              </p>
            </div>
          )}

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
            Offduty only uses these permissions to batch your email. Your data is never shared.
          </p>

          <a
            href="/api/connect-inbox"
            className="w-full flex items-center justify-center gap-2 bg-[#A78BFA] hover:bg-[#8B5CF6] text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors"
          >
            {showBillingWarning ? "Confirm & continue with Google" : "Continue with Google"}
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
