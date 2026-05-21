import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ArrowLeft } from "lucide-react"
import { UserMenu } from "@/components/UserMenu"
import { format } from "date-fns"
import { RemoveInboxButton, DeleteAccountButton } from "@/components/AccountClient"

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      inboxes: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  })
  if (!user) redirect("/login")

  const joinDate = format(user.createdAt, "MMM d, yyyy")
  const primaryInbox = user.inboxes.find((i) => i.isPrimary) ?? user.inboxes[0]

  const subStatus = user.subscriptionStatus ?? "trialing"
  const trialDaysLeft = subStatus === "trialing" && user.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const subBadge =
    subStatus === "active"
      ? { label: "Subscribed", classes: "bg-green-50 text-green-600" }
      : subStatus === "trialing"
      ? { label: trialDaysLeft !== null ? `Trial · ${trialDaysLeft}d left` : "Trial", classes: "bg-[#ededff] text-[#A78BFA]" }
      : subStatus === "past_due"
      ? { label: "Payment failed", classes: "bg-[#fff1f3] text-[#F43F5E]" }
      : { label: "Expired", classes: "bg-gray-50 text-[#4D4D4D]" }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-[#4D4D4D] hover:text-[#4D4D4D]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-75 transition-opacity">
          <img src="/offduty-icon.svg" alt="" className="h-7 w-7" />
          <span className="font-bold text-lg text-[#161616]" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>offduty</span>
        </Link>
        <div className="ml-auto">
          <UserMenu email={user.email} image={user.image ?? null} settingsHref="/settings" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 flex-1 w-full">
        <h1 className="text-2xl font-bold text-[#161616] mb-6">Account</h1>

        {/* Profile */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 mb-4">
          <div className="flex items-center gap-4">
            {primaryInbox?.image && (
              <Image
                src={primaryInbox.image}
                alt=""
                width={64}
                height={64}
                className="rounded-xl"
              />
            )}
            <div>
              <p className="font-semibold text-[#161616] text-lg">{primaryInbox?.name ?? user.name}</p>
              <p className="text-[#4D4D4D] text-sm">{user.email}</p>
              <p className="text-[#4D4D4D] text-xs mt-0.5">Member since {joinDate}</p>
            </div>
          </div>
        </div>

        {/* Connected inboxes */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 mb-4">
          <h2 className="font-semibold text-[#161616] mb-1">Inboxes</h2>
          <p className="text-sm text-[#4D4D4D] mb-4">All your connected Gmail accounts.</p>

          <div className="space-y-3">
            {user.inboxes.map((inbox) => (
              <div
                key={inbox.id}
                className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0"
              >
                {inbox.image ? (
                  <Image src={inbox.image} alt="" width={40} height={40} className="rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[#161616] text-sm truncate">{inbox.name}</span>
                    {inbox.isPrimary && (
                      <span className="text-xs bg-[#ededff] text-[#A78BFA] font-medium px-2 py-0.5 rounded-full">
                        Primary
                      </span>
                    )}
                    {inbox.isPrimary && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${subBadge.classes}`}>
                        {subBadge.label}
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      inbox.isActive
                        ? "bg-green-50 text-green-600"
                        : "bg-gray-50 text-[#4D4D4D]"
                    }`}>
                      {inbox.isActive ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="text-xs text-[#4D4D4D] mt-0.5">{inbox.email}</p>
                </div>
                {!inbox.isPrimary && (
                  <RemoveInboxButton inbox={{
                    ...inbox,
                    isPaidSeat: subStatus === "active" && !inbox.scheduledRemovalAt,
                    isSubscribed: subStatus === "active",
                    scheduledRemovalAt: inbox.scheduledRemovalAt?.toISOString() ?? null,
                  }} />
                )}
              </div>
            ))}
          </div>

          <Link
            href="/connect-inbox"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#A78BFA] hover:underline"
          >
            + Add another inbox
          </Link>
        </div>

        {/* Danger zone */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
          <h2 className="font-semibold text-[#161616] mb-1">Delete Account</h2>
          <p className="text-sm text-[#4D4D4D] mb-4">
            Permanently deletes your account and all {user.inboxes.length} connected{" "}
            {user.inboxes.length === 1 ? "inbox" : "inboxes"}. This cannot be undone.
          </p>
          <DeleteAccountButton subscriptionStatus={subStatus} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] py-6 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/offduty-icon.svg" alt="" className="w-5 h-5" />
          <span className="text-sm font-bold text-[#161616]" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>offduty</span>
        </div>
        <span className="text-xs text-[#4D4D4D]">© {new Date().getFullYear()} DiscoveryCo</span>
      </footer>
    </div>
  )
}
