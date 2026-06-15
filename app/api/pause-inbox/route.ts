import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getGmailClient, ensureHoldLabel, releaseEmails } from "@/lib/gmail"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!rateLimit(`pause-inbox:${session.user.email}`, 15, 60_000)) return tooManyRequests()

  const { inboxId, until } = await req.json().catch(() => ({}))
  if (!inboxId) return NextResponse.json({ error: "Missing inboxId" }, { status: 400 })

  const inbox = await prisma.inbox.findFirst({
    where: { id: inboxId, user: { email: session.user.email } },
  })
  if (!inbox) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!inbox.isActive) return NextResponse.json({ error: "Inbox is not active" }, { status: 400 })

  const pausedUntil = until ? new Date(until) : null

  try {
    await prisma.inbox.update({
      where: { id: inboxId },
      data: { pausedUntil },
    })

    // When pausing, release any currently held emails into the inbox
    if (pausedUntil) {
      const gmail = await getGmailClient(inbox)
      const holdLabelId = await ensureHoldLabel(gmail, inbox.id)
      const count = await releaseEmails(gmail, holdLabelId)
      if (count > 0) {
        await prisma.activityLog.create({
          data: { inboxId: inbox.id, emailCount: count, slotTime: "Hold lifted" },
        })
      }
      return NextResponse.json({ pausedUntil: pausedUntil.toISOString(), released: count })
    }
  } catch (err) {
    console.error("pause-inbox error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  return NextResponse.json({ pausedUntil: null })
}
