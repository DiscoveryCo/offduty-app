import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Mail, ArrowLeft } from "lucide-react"
import { VipSettings } from "@/components/VipSettings"
import { DeliverySettings } from "@/components/DeliverySettings"
import { UserMenu } from "@/components/UserMenu"
import { InboxSwitcher } from "@/components/InboxSwitcher"
import { Suspense } from "react"

async function SettingsContent({ tab, inboxId }: { tab: string; inboxId?: string }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const activeTab = tab === "delivery" ? "delivery" : "vip"

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

  const inbox = inboxId
    ? await prisma.inbox.findFirst({ where: { id: inboxId, userId: user.id } })
    : await prisma.inbox.findFirst({ where: { userId: user.id, isPrimary: true } })
      ?? await prisma.inbox.findFirst({ where: { userId: user.id } })

  if (!inbox) redirect("/login")

  const fullInbox = await prisma.inbox.findUnique({
    where: { id: inbox.id },
    include: { settings: true, vipRules: true, schedules: true },
  })
  if (!fullInbox) redirect("/login")

  const domains = fullInbox.vipRules.filter((r) => r.type === "DOMAIN").map((r) => r.value)
  const emails = fullInbox.vipRules.filter((r) => r.type === "EMAIL").map((r) => r.value)
  const keywords = fullInbox.vipRules.filter((r) => r.type === "KEYWORD").map((r) => r.value)

  const customDailyTimes = fullInbox.schedules
    .filter((s) => s.dayOfWeek === -1)
    .map((s) => s.time)
    .sort()

  const weeklySchedule = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    dayOfWeek: day,
    times: fullInbox.schedules
      .filter((s) => s.dayOfWeek === day)
      .map((s) => s.time)
      .sort(),
  }))

  const settings = fullInbox.settings
  const dashboardHref = `/dashboard?inbox=${fullInbox.id}`
  const baseHref = `/settings?inbox=${fullInbox.id}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 grid grid-cols-3 items-center">
        <div className="flex items-center gap-3">
          <Link href={dashboardHref} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Link href={dashboardHref} className="flex items-center gap-2 hover:opacity-75 transition-opacity">
            <Mail className="w-5 h-5 text-[#7c7cf8]" />
            <span className="font-bold text-lg tracking-tight text-gray-900">DiscoveryMail</span>
          </Link>
        </div>
        <div className="flex justify-center">
          <InboxSwitcher
            inboxes={user.inboxes}
            currentInboxId={fullInbox.id}
            hrefPrefix={`/settings?tab=${activeTab}&inbox=`}
          />
        </div>
        <div className="flex justify-end">
          <UserMenu email={user.email} image={user.image ?? null} settingsHref={`/settings?inbox=${fullInbox.id}`} dashboardHref={`/dashboard?inbox=${fullInbox.id}`} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8">
          <Link
            href={`${baseHref}&tab=vip`}
            className={`px-4 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "vip"
                ? "border-[#7c7cf8] text-[#7c7cf8]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            VIP
          </Link>
          <Link
            href={`${baseHref}&tab=delivery`}
            className={`px-4 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "delivery"
                ? "border-[#7c7cf8] text-[#7c7cf8]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Delivery Slots
          </Link>
        </div>

        {activeTab === "vip" ? (
          <VipSettings inboxId={fullInbox.id} domains={domains} emails={emails} keywords={keywords} />
        ) : (
          <DeliverySettings
            inboxId={fullInbox.id}
            scheduleType={(settings?.scheduleType ?? "custom_weekly") as "interval" | "times" | "custom_daily" | "custom_weekly"}
            intervalHours={settings?.intervalHours ?? null}
            timesPerDay={settings?.timesPerDay ?? null}
            customDailyTimes={customDailyTimes}
            weeklySchedule={weeklySchedule}
            dndEnabled={settings?.dndEnabled ?? false}
            dndFrom={settings?.dndFrom ?? "22:00"}
            dndTo={settings?.dndTo ?? "07:00"}
            timezone={settings?.timezone ?? "UTC"}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 px-6 flex items-center justify-between mt-10">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#7c7cf8]" />
          <span className="text-sm font-semibold text-gray-700">DiscoveryMail</span>
        </div>
        <div className="flex gap-5 text-xs text-gray-400">
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; inbox?: string }>
}) {
  const params = await searchParams
  return (
    <Suspense>
      <SettingsContent tab={params.tab ?? "vip"} inboxId={params.inbox} />
    </Suspense>
  )
}
