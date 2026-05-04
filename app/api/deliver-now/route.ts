import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getGmailClient, ensureHoldLabel, releaseEmails } from "@/lib/gmail"

export async function POST() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const gmail = await getGmailClient(user)
  const holdLabelId = await ensureHoldLabel(gmail, user.id)
  const count = await releaseEmails(gmail, holdLabelId)

  if (count > 0) {
    await prisma.activityLog.create({
      data: { userId: user.id, emailCount: count, slotTime: "On demand" },
    })
  }

  return NextResponse.json({ count })
}
