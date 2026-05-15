import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  getGmailClient,
  ensureHoldLabel,
  releaseEmails,
  registerWatch,
  stopWatch,
} from "@/lib/gmail"
import { isAllowedToHold } from "@/lib/scheduler"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { inboxId } = await req.json().catch(() => ({}))

  const inbox = await prisma.inbox.findFirst({
    where: {
      id: inboxId,
      user: { email: session.user.email },
    },
    include: { user: true },
  })
  if (!inbox) return NextResponse.json({ error: "Inbox not found" }, { status: 404 })

  // Block activation if trial has expired and no active subscription
  if (!inbox.isActive && !isAllowedToHold(inbox.user)) {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 })
  }

  const gmail = await getGmailClient(inbox)

  if (inbox.isActive) {
    const holdLabelId = await ensureHoldLabel(gmail, inbox.id)
    const count = await releaseEmails(gmail, holdLabelId)
    if (count > 0) {
      await prisma.activityLog.create({
        data: { inboxId: inbox.id, emailCount: count, slotTime: "Stopped" },
      })
    }
    await stopWatch(gmail)
    await prisma.inbox.update({ where: { id: inbox.id }, data: { isActive: false, pausedUntil: null } })
    return NextResponse.json({ isActive: false })
  } else {
    await ensureHoldLabel(gmail, inbox.id)
    await registerWatch(gmail, inbox.id)
    await prisma.inbox.update({ where: { id: inbox.id }, data: { isActive: true } })
    return NextResponse.json({ isActive: true })
  }
}
