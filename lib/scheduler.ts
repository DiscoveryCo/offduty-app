import { prisma } from "@/lib/db"
import { getGmailClient, ensureHoldLabel, releaseEmails, stopWatch, registerWatch } from "@/lib/gmail"

export function isAllowedToHold(user: { subscriptionStatus: string; trialEndsAt: Date | null }): boolean {
  if (user.subscriptionStatus === "active") return true
  if (user.subscriptionStatus === "trialing" && user.trialEndsAt && user.trialEndsAt > new Date()) return true
  return false
}

function isInDndWindow(dndFrom: string, dndTo: string, nowMinutes: number): boolean {
  const [fH, fM] = dndFrom.split(":").map(Number)
  const [tH, tM] = dndTo.split(":").map(Number)
  const from = fH * 60 + fM
  const to = tH * 60 + tM

  if (from <= to) return nowMinutes >= from && nowMinutes < to
  // overnight window (e.g. 22:00–07:00)
  return nowMinutes >= from || nowMinutes < to
}

function getLocalTime(date: Date, tz: string): { time: string; day: number } {
  // Use en-CA locale which formats as "YYYY-MM-DD, HH:MM" — reliable for parsing
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const formatted = formatter.format(date) // e.g. "2024-06-15, 14:30"
  const [datePart, timePart] = formatted.split(", ")
  const [year, month, dayOfMonth] = datePart.split("-").map(Number)
  const localDate = new Date(year, month - 1, dayOfMonth)
  return {
    time: timePart.substring(0, 5), // "14:30"
    day: localDate.getDay(),        // 0 = Sunday … 6 = Saturday
  }
}

function getDeliveryTimesForNow(
  scheduleType: string,
  intervalHours: number | null,
  timesPerDay: number | null,
  schedules: { dayOfWeek: number; time: string }[],
  now: Date,
  timezone: string
): string[] {
  const { time: currentTime, day } = getLocalTime(now, timezone)
  const [hourStr] = currentTime.split(":")
  const h = parseInt(hourStr)

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
    const [, minStr] = currentTime.split(":")
    if (parseInt(minStr) === 0 && h % intervalHours === 0) return [currentTime]
    return []
  }

  if (scheduleType === "times" && timesPerDay && timesPerDay >= 2) {
    const interval = Math.floor(24 / timesPerDay)
    const [, minStr] = currentTime.split(":")
    if (parseInt(minStr) === 0 && h % interval === 0) return [currentTime]
    return []
  }

  return []
}

export async function checkAndDeliverForInbox(inboxId: string) {
  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
    include: {
      settings: true,
      schedules: true,
      vipRules: true,
    },
  })
  if (!inbox || !inbox.isActive || !inbox.holdLabelId) return

  const settings = inbox.settings
  const timezone = settings?.timezone ?? "UTC"
  const now = new Date()
  const { time: localTime } = getLocalTime(now, timezone)
  const [lh, lm] = localTime.split(":").map(Number)
  const nowMinutes = lh * 60 + lm

  if (settings?.dndEnabled && settings.dndFrom && settings.dndTo) {
    if (isInDndWindow(settings.dndFrom, settings.dndTo, nowMinutes)) return
  }

  const deliverySlots = getDeliveryTimesForNow(
    settings?.scheduleType ?? "custom_weekly",
    settings?.intervalHours ?? null,
    settings?.timesPerDay ?? null,
    inbox.schedules,
    now,
    timezone
  )

  if (deliverySlots.length === 0) return

  const gmail = await getGmailClient(inbox)
  const holdLabelId = await ensureHoldLabel(gmail, inboxId)
  const count = await releaseEmails(gmail, holdLabelId)

  if (count > 0) {
    const slotLabel = deliverySlots[0]
    await prisma.activityLog.create({
      data: { inboxId, emailCount: count, slotTime: slotLabel },
    })
  }
}

export async function checkAndDeliverAll() {
  const activeInboxes = await prisma.inbox.findMany({
    where: { isActive: true },
    select: { id: true },
  })
  await Promise.allSettled(activeInboxes.map((i) => checkAndDeliverForInbox(i.id)))
}

export async function renewAllWatches() {
  const renewBefore = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const inboxes = await prisma.inbox.findMany({
    where: {
      isActive: true,
      OR: [
        { watchExpiry: null },
        { watchExpiry: { lte: renewBefore } },
      ],
    },
  })

  await Promise.allSettled(
    inboxes.map(async (inbox) => {
      try {
        const gmail = await getGmailClient(inbox)
        await registerWatch(gmail, inbox.id)
        console.log(`[watchRenewal] Renewed watch for ${inbox.email}`)
      } catch (err) {
        console.error(`[watchRenewal] Failed to renew watch for ${inbox.email}:`, err)
      }
    })
  )
}

export async function enforceTrialExpiry() {
  const expiredInboxes = await prisma.inbox.findMany({
    where: {
      isActive: true,
      user: {
        subscriptionStatus: "trialing",
        trialEndsAt: { lte: new Date() },
      },
    },
    include: { user: true },
  })

  await Promise.allSettled(
    expiredInboxes.map(async (inbox) => {
      try {
        const gmail = await getGmailClient(inbox)
        if (inbox.holdLabelId) {
          await releaseEmails(gmail, inbox.holdLabelId)
        }
        await stopWatch(gmail)
        await prisma.inbox.update({
          where: { id: inbox.id },
          data: { isActive: false },
        })
        console.log(`[trialExpiry] Deactivated inbox ${inbox.email} — trial ended`)
      } catch (err) {
        console.error(`[trialExpiry] Failed to deactivate inbox ${inbox.email}:`, err)
      }
    })
  )
}
