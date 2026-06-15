import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getGmailClient, ensureHoldLabel, releaseEmails } from "@/lib/gmail"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!rateLimit(`deliver-now:${session.user.email}`, 8, 60_000)) return tooManyRequests()

  const { inboxId } = await req.json().catch(() => ({}))

  const inbox = await prisma.inbox.findFirst({
    where: {
      id: inboxId,
      user: { email: session.user.email },
    },
  })
  if (!inbox) return NextResponse.json({ error: "Inbox not found" }, { status: 404 })

  const gmail = await getGmailClient(inbox)
  const holdLabelId = await ensureHoldLabel(gmail, inbox.id)
  const count = await releaseEmails(gmail, holdLabelId)

  if (count > 0) {
    await prisma.activityLog.create({
      data: { inboxId: inbox.id, emailCount: count, slotTime: "On demand" },
    })
  }

  return NextResponse.json({ count })
}
