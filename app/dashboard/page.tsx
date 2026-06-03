import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Image from "next/image"
import { DashboardActions } from "@/components/DashboardClient"
import { UserMenu } from "@/components/UserMenu"
import { InboxSwitcher } from "@/components/InboxSwitcher"
import { getGmailClient, getHeldCount } from "@/lib/gmail"
import { ActivityPagination } from "@/components/ActivityPagination"
import { HeldEmailsCard } from "@/components/HeldEmailsCard"
import { AutoRefresh } from "@/components/AutoRefresh"
import { formatDistanceToNow, format } from "date-fns"
import { Suspense } from "react"

const PAGE_SIZE = 15

function scheduleLabel(settings: { scheduleType: string; intervalHours?: number | null; timesPerDay?: number | null } | null) {
  if (!settings) return "no schedule"
  if (settings.scheduleType === "interval" && settings.intervalHours)
    return `every ${settings.intervalHours} hour${settings.intervalHours > 1 ? "s" : ""}`
  if (settings.scheduleType === "times" && settings.timesPerDay)
    return `${settings.timesPerDay} times a day`
  if (settings.scheduleType === "custom_daily") return "a custom daily schedule"
  if (settings.scheduleType === "custom_weekly") return "a custom weekly schedule"
  return "a custom schedule"
}

function formatDate(date: Date) {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 24 * 60 * 60 * 1000) return formatDistanceToNow(date, { addSuffix: true })
  if (diffMs < 48 * 60 * 60 * 1000) return "Yesterday"
  return format(date, "MMM d, yyyy")
}

async function DashboardContent({ page, inboxId }: { page: number; inboxId?: string }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      inboxes: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: { id: true, email: true, image: true },
      },
    },
  })
  if (!user) redirect("/login")
  if (user.inboxes.length === 0) redirect("/login")

  const inbox = inboxId
    ? await prisma.inbox.findFirst({ where: { id: inboxId, userId: user.id } })
    : null
  const activeInbox = inbox ?? (await prisma.inbox.findFirst({
    where: { userId: user.id, isPrimary: true },
  })) ?? (await prisma.inbox.findFirst({ where: { userId: user.id } }))

  if (!activeInbox) redirect("/login")

  const fullInbox = await prisma.inbox.findUnique({
    where: { id: activeInbox.id },
    include: {
      settings: true,
      vipRules: true,
      activityLogs: {
        orderBy: { deliveredAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      },
    },
  })
  if (!fullInbox) redirect("/login")

  const totalLogs = await prisma.activityLog.count({ where: { inboxId: fullInbox.id } })
  const totalPages = Math.ceil(totalLogs / PAGE_SIZE)

  const domainCount = fullInbox.vipRules.filter((r) => r.type === "DOMAIN").length
  const emailCount = fullInbox.vipRules.filter((r) => r.type === "EMAIL").length
  const keywordCount = fullInbox.vipRules.filter((r) => r.type === "KEYWORD").length

  const joinDate = format(user.createdAt, "MMM d, yyyy")

  const trialDaysLeft = user.trialEndsAt && user.subscriptionStatus === "trialing"
    ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  let heldCount = 0
  if (fullInbox.isActive && fullInbox.holdLabelId) {
    try {
      const gmail = await getGmailClient(fullInbox)
      heldCount = await getHeldCount(gmail, fullInbox.holdLabelId)
    } catch {
      // non-fatal
    }
  }

  const settingsHref = `/settings?inbox=${fullInbox.id}`

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {fullInbox.isActive && <AutoRefresh intervalMs={30000} />}
      {/* Header */}
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-3 grid grid-cols-3 items-center">
        <div className="flex items-center gap-2">
          <img src="/offduty-icon.svg" alt="" className="h-7 w-7" />
          <span className="hidden sm:inline font-bold text-lg text-[#161616]" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>offduty</span>
        </div>
        <div className="flex justify-center">
          <InboxSwitcher inboxes={user.inboxes} currentInboxId={fullInbox.id} />
        </div>
        <div className="flex justify-end">
          <UserMenu email={user.email} image={user.image ?? null} settingsHref={settingsHref} dashboardHref={`/dashboard?inbox=${fullInbox.id}`} />
        </div>
      </header>

      {/* Trial banner — full width, between header and main */}
      {trialDaysLeft !== null && (
        <div className="w-full bg-[#ededff] border-b border-[#d4d4fc] px-6 py-2.5 text-center text-sm text-[#5b5bd6]">
          🚀 {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left in your free trial.{" "}
          <Link href="/billing" className="font-semibold underline underline-offset-2 hover:text-[#4a4ac4] transition-colors">
            Upgrade now
          </Link>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8 flex-1 w-full">
        {/* Subscription banners */}
        {user.subscriptionStatus === "canceled" && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-amber-700">
              Your Offduty subscription has ended. Your emails are no longer being held.
            </p>
            <Link
              href="/billing"
              className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Subscribe
            </Link>
          </div>
        )}
        {user.subscriptionStatus === "past_due" && (
          <div className="mb-6 bg-[#fff1f3] border border-[#fda4af] rounded-xl px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-[#be1d37]">
              Your last payment failed. Update your payment details to keep emails held.
            </p>
            <Link
              href="/billing"
              className="flex-shrink-0 bg-[#F43F5E] hover:bg-[#d93652] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Fix Payment
            </Link>
          </div>
        )}

        {/* Profile + actions */}
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {fullInbox.image && (
              <Image src={fullInbox.image} alt="" width={52} height={52} className="rounded-xl" />
            )}
            <div>
              <p className="font-semibold text-[#161616] text-lg border-0">{fullInbox.name}</p>
              <p className="text-[#4D4D4D] text-sm border-0">{fullInbox.email}</p>
              <p className="text-[#4D4D4D] text-xs mt-0.5 border-0">Member since {joinDate}</p>
            </div>
          </div>
          <DashboardActions key={fullInbox.id} isActive={fullInbox.isActive} inboxId={fullInbox.id} pausedUntil={fullInbox.pausedUntil?.toISOString() ?? null} />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <p className="text-xs font-semibold text-[#4D4D4D] uppercase tracking-widest mb-2">
              VIP List
            </p>
            <p className="text-sm text-[#4D4D4D] leading-relaxed">
              You have <strong className="text-[#161616]">{domainCount} domain{domainCount !== 1 ? "s" : ""}</strong>,{" "}
              <strong className="text-[#161616]">{emailCount} email address{emailCount !== 1 ? "es" : ""}</strong> and{" "}
              <strong className="text-[#161616]">{keywordCount} keyword{keywordCount !== 1 ? "s" : ""}</strong> in your VIP List.
            </p>
            <Link href={`${settingsHref}&tab=vip`} className="text-[#A78BFA] text-sm mt-2 inline-block hover:underline">
              Manage VIPs
            </Link>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <p className="text-xs font-semibold text-[#4D4D4D] uppercase tracking-widest mb-2">
              Delivery
            </p>
            <p className="text-sm text-[#4D4D4D] leading-relaxed">
              Your emails are delivered at{" "}
              <strong className="text-[#161616]">{scheduleLabel(fullInbox.settings)}</strong>.{" "}
              {fullInbox.settings?.dndEnabled && fullInbox.settings.dndFrom && fullInbox.settings.dndTo
                ? `DND active from ${fullInbox.settings.dndFrom} to ${fullInbox.settings.dndTo}.`
                : "You do not have any DND period set."}
            </p>
            <Link href={`${settingsHref}&tab=delivery`} className="text-[#A78BFA] text-sm mt-2 inline-block hover:underline">
              Manage delivery
            </Link>
          </div>

          <HeldEmailsCard heldCount={heldCount} isActive={fullInbox.isActive} pausedUntil={fullInbox.pausedUntil?.toISOString() ?? null} />
        </div>

        {/* Activity Log */}
        <div>
          <div className="flex items-center mb-4">
            <h2 className="text-lg font-semibold text-[#161616]">Activity Log</h2>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[#4D4D4D] text-xs uppercase tracking-widest">
                  <th className="text-left px-5 py-3 font-medium w-48">Date</th>
                  <th className="text-right px-5 py-3 font-medium">Emails Processed</th>
                </tr>
              </thead>
              <tbody>
                {fullInbox.activityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-5 py-10 text-center text-[#4D4D4D]">
                      No deliveries yet. Start Offduty to begin batching your inbox.
                    </td>
                  </tr>
                ) : (
                  fullInbox.activityLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-[#161616]">{formatDate(log.deliveredAt)}</p>
                        {log.slotTime && <p className="text-[#4D4D4D] text-xs mt-0.5">{log.slotTime}</p>}
                      </td>
                      <td className="px-5 py-3 text-right text-[#161616] font-medium">{log.emailCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <ActivityPagination page={page} pages={totalPages} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] py-6 px-6 flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <img src="/offduty-icon.svg" alt="" className="w-5 h-5" />
          <span className="text-sm font-bold text-[#161616]" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>offduty</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#9CA3AF]">
          <span>© {new Date().getFullYear()} DiscoveryCo</span>
          <a href="https://offduty.me/terms" target="_blank" rel="noopener noreferrer" className="hover:text-[#4D4D4D] transition-colors">Terms</a>
          <a href="https://offduty.me/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-[#4D4D4D] transition-colors">Privacy</a>
        </div>
      </footer>
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; inbox?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10))
  const inboxId = params.inbox

  return (
    <Suspense>
      <DashboardContent page={page} inboxId={inboxId} />
    </Suspense>
  )
}
