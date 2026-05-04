import { prisma } from "@/lib/db"
import { getGmailClient, ensureHoldLabel, releaseEmails } from "@/lib/gmail"

function isInDndWindow(dndFrom: string, dndTo: string, nowMinutes: number): boolean {
  const [fH, fM] = dndFrom.split(":").map(Number)
  const [tH, tM] = dndTo.split(":").map(Number)
  const from = fH * 60 + fM
  const to = tH * 60 + tM

  if (from <= to) return nowMinutes >= from && nowMinutes < to
  // overnight window (e.g. 22:00–07:00)
  return nowMinutes >= from || nowMinutes < to
}

function getDeliveryTimesForNow(
  scheduleType: string,
  intervalHours: number | null,
  timesPerDay: number | null,
  schedules: { dayOfWeek: number; time: string }[],
  now: Date
): string[] {
  const pad = (n: number) => String(n).padStart(2, "0")
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  const day = now.getDay()

  if (scheduleType === "custom_weekly") {
    return schedules
      .filter((s) => s.dayOfWeek === day && s.time === currentTime)
      .map((s) => s.time)
  }

  if (scheduleType === "custom_daily") {
    return schedules
      .filter((s) => s.dayOfWeek === -1 && s.time === currentTime)
      .map((s) => s.time)
  }

  if (scheduleType === "interval" && intervalHours) {
    const h = now.getHours()
    if (now.getMinutes() === 0 && h % intervalHours === 0) return [currentTime]
    return []
  }

  if (scheduleType === "times" && timesPerDay && timesPerDay >= 2) {
    const interval = Math.floor(24 / timesPerDay)
    const h = now.getHours()
    if (now.getMinutes() === 0 && h % interval === 0) return [currentTime]
    return []
  }

  return []
}

export async function checkAndDeliverForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      settings: true,
      schedules: true,
      vipRules: true,
    },
  })
  if (!user || !user.isActive || !user.holdLabelId) return

  const settings = user.settings
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  if (settings?.dndEnabled && settings.dndFrom && settings.dndTo) {
    if (isInDndWindow(settings.dndFrom, settings.dndTo, nowMinutes)) return
  }

  const deliverySlots = getDeliveryTimesForNow(
    settings?.scheduleType ?? "custom_weekly",
    settings?.intervalHours ?? null,
    settings?.timesPerDay ?? null,
    user.schedules,
    now
  )

  if (deliverySlots.length === 0) return

  const gmail = await getGmailClient(user)
  const holdLabelId = await ensureHoldLabel(gmail, userId)
  const count = await releaseEmails(gmail, holdLabelId)

  if (count > 0) {
    const slotLabel = deliverySlots[0]
    await prisma.activityLog.create({
      data: { userId, emailCount: count, slotTime: slotLabel },
    })
  }
}

export async function checkAndDeliverAll() {
  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  })
  await Promise.allSettled(activeUsers.map((u) => checkAndDeliverForUser(u.id)))
}
