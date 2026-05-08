import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Image from "next/image"
import { Mail, Settings } from "lucide-react"
import { DashboardActions } from "@/components/DashboardClient"
import { UserMenu } from "@/components/UserMenu"
import { getGmailClient, ensureHoldLabel, getHeldCount } from "@/lib/gmail"
import { ActivityPagination } from "@/components/ActivityPagination"
import { HeldEmailsCard } from "@/components/HeldEmailsCard"
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

async function DashboardContent({ page }: { page: number }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
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
  if (!user) redirect("/login")

  const totalLogs = await prisma.activityLog.count({ where: { userId: user.id } })
  const totalPages = Math.ceil(totalLogs / PAGE_SIZE)

  const domainCount = user.vipRules.filter((r) => r.type === "DOMAIN").length
  const emailCount = user.vipRules.filter((r) => r.type === "EMAIL").length
  const keywordCount = user.vipRules.filter((r) => r.type === "KEYWORD").length

  const joinDate = format(user.createdAt, "MMM d, yyyy")

  let heldCount = 0
  if (user.isActive && user.holdLabelId) {
    try {
      const gmail = await getGmailClient(user)
      heldCount = await getHeldCount(gmail, user.holdLabelId)
    } catch {
      // non-fatal — just show 0
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1d2e] text-white">
      {/* Top bar */}
      <header className="border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#7c7cf8]" />
          <span className="font-bold text-lg tracking-tight">DiscoveryMail</span>
        </div>
        <UserMenu email={user.email} image={user.image ?? null} />
      </header>

      {/* Profile + actions */}
      <div className="px-6 py-6 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-4">
          {user.image && <Image src={user.image} alt="" width={56} height={56} className="rounded-full" />}
          <div>
            <p className="font-semibold text-lg">{user.name}</p>
            <p className="text-slate-400 text-sm">{user.email}</p>
            <p className="text-slate-500 text-xs mt-0.5">Member since {joinDate}</p>
          </div>
        </div>
        <DashboardActions isActive={user.isActive} userEmail={user.email} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-6">
        <div className="bg-[#242740] rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            VIP List
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            You have <strong className="text-white">{domainCount} domain{domainCount !== 1 ? "s" : ""}</strong>,{" "}
            <strong className="text-white">{emailCount} email address{emailCount !== 1 ? "es" : ""}</strong> and{" "}
            <strong className="text-white">{keywordCount} keyword{keywordCount !== 1 ? "s" : ""}</strong> in your VIP List.
          </p>
          <Link href="/settings?tab=vip" className="text-[#7c7cf8] text-sm mt-2 inline-block hover:underline">
            Manage VIPs
          </Link>
        </div>

        <div className="bg-[#242740] rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Delivery
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            Your emails are delivered at{" "}
            <strong className="text-white">{scheduleLabel(user.settings)}</strong>.{" "}
            {user.settings?.dndEnabled && user.settings.dndFrom && user.settings.dndTo
              ? `DND active from ${user.settings.dndFrom} to ${user.settings.dndTo}.`
              : "You do not have any DND period set."}
          </p>
          <Link href="/settings?tab=delivery" className="text-[#7c7cf8] text-sm mt-2 inline-block hover:underline">
            Manage delivery
          </Link>
        </div>

        <HeldEmailsCard heldCount={heldCount} isActive={user.isActive} />

      </div>

      {/* Activity Log */}
      <div className="px-6 pb-10">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">Activity Log</h2>
          <Link href="/settings" className="ml-auto text-slate-400 hover:text-white">
            <Settings className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-[#242740] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-widest">
                <th className="text-left px-5 py-3 font-medium w-48">Date</th>
                <th className="text-right px-5 py-3 font-medium">Emails Processed</th>
              </tr>
            </thead>
            <tbody>
              {user.activityLogs.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-5 py-10 text-center text-slate-500">
                    No deliveries yet. Start DiscoveryMail to begin batching your inbox.
                  </td>
                </tr>
              ) : (
                user.activityLogs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-slate-300">{formatDate(log.deliveredAt)}</p>
                      {log.slotTime && <p className="text-slate-500 text-xs mt-0.5">{log.slotTime}</p>}
                    </td>
                    <td className="px-5 py-3 text-right text-white font-medium">{log.emailCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <ActivityPagination page={page} pages={totalPages} />
      </div>
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10))

  return (
    <Suspense>
      <DashboardContent page={page} />
    </Suspense>
  )
}
