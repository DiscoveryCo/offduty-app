import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const inboxId = req.nextUrl.searchParams.get("inboxId")
  if (!inboxId) return NextResponse.json({ error: "Missing inboxId" }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const inbox = await prisma.inbox.findFirst({
    where: { id: inboxId, userId: user.id },
    include: { settings: true, vipRules: true, schedules: true },
  })
  if (!inbox) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const domains = inbox.vipRules.filter((r) => r.type === "DOMAIN").map((r) => r.value)
  const emails = inbox.vipRules.filter((r) => r.type === "EMAIL").map((r) => r.value)
  const keywords = inbox.vipRules.filter((r) => r.type === "KEYWORD").map((r) => r.value)

  const customDailyTimes = inbox.schedules
    .filter((s) => s.dayOfWeek === -1)
    .map((s) => s.time)
    .sort()

  const weeklySchedule = [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    dayOfWeek: day,
    times: inbox.schedules
      .filter((s) => s.dayOfWeek === day)
      .map((s) => s.time)
      .sort(),
  }))

  return NextResponse.json({
    delivery: {
      scheduleType: inbox.settings?.scheduleType ?? "custom_weekly",
      intervalHours: inbox.settings?.intervalHours ?? null,
      timesPerDay: inbox.settings?.timesPerDay ?? null,
      customDailyTimes,
      weeklySchedule,
      dndEnabled: inbox.settings?.dndEnabled ?? false,
      dndFrom: inbox.settings?.dndFrom ?? "22:00",
      dndTo: inbox.settings?.dndTo ?? "07:00",
      timezone: inbox.settings?.timezone ?? "UTC",
    },
    vip: { domains, emails, keywords },
  })
}
