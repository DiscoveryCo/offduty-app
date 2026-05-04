import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Mail, ArrowLeft } from "lucide-react"
import { VipSettings } from "@/components/VipSettings"
import { DeliverySettings } from "@/components/DeliverySettings"

function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "UTC"
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { settings: true, vipRules: true, schedules: true },
  })
  if (!user) redirect("/login")

  const params = await searchParams
  const activeTab = params.tab === "delivery" ? "delivery" : "vip"

  const domains = user.vipRules.filter((r) => r.type === "DOMAIN").map((r) => r.value)
  const emails = user.vipRules.filter((r) => r.type === "EMAIL").map((r) => r.value)
  const keywords = user.vipRules.filter((r) => r.type === "KEYWORD").map((r) => r.value)

  const customDailyTimes = user.schedules
    .filter((s) => s.dayOfWeek === -1)
    .map((s) => s.time)
    .sort()

  const weeklySchedule = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    dayOfWeek: day,
    times: user.schedules
      .filter((s) => s.dayOfWeek === day)
      .map((s) => s.time)
      .sort(),
  }))

  const settings = user.settings

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#7c7cf8]" />
          <span className="font-bold text-lg tracking-tight text-gray-900">DiscoveryMail</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8">
          <Link
            href="/settings?tab=vip"
            className={`px-4 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "vip"
                ? "border-[#7c7cf8] text-[#7c7cf8]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            VIP
          </Link>
          <Link
            href="/settings?tab=delivery"
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
          <VipSettings domains={domains} emails={emails} keywords={keywords} />
        ) : (
          <DeliverySettings
            scheduleType={(settings?.scheduleType ?? "custom_weekly") as "interval" | "times" | "custom_daily" | "custom_weekly"}
            intervalHours={settings?.intervalHours ?? null}
            timesPerDay={settings?.timesPerDay ?? null}
            customDailyTimes={customDailyTimes}
            weeklySchedule={weeklySchedule}
            dndEnabled={settings?.dndEnabled ?? false}
            dndFrom={settings?.dndFrom ?? "22:00"}
            dndTo={settings?.dndTo ?? "07:00"}
            timezone={getTimezone()}
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
