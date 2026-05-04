import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getGmailClient, ensureHoldLabel, registerWatch } from "@/lib/gmail"

export async function POST() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const gmail = await getGmailClient(user)
  await ensureHoldLabel(gmail, user.id)
  await registerWatch(gmail, user.id)

  return NextResponse.json({ ok: true })
}
