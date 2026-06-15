import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const inboxId = req.nextUrl.searchParams.get("inboxId")

  const inbox = await prisma.inbox.findFirst({
    where: {
      id: inboxId ?? undefined,
      user: { email: session.user.email },
    },
    include: { vipRules: true },
  })
  if (!inbox) return NextResponse.json({ error: "Inbox not found" }, { status: 404 })

  return NextResponse.json(inbox.vipRules)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!rateLimit(`vip:${session.user.email}`, 30, 60_000)) return tooManyRequests()

  const body = await req.json()
  const { inboxId, domains = [], emails = [], keywords = [] } = body

  const inbox = await prisma.inbox.findFirst({
    where: {
      id: inboxId,
      user: { email: session.user.email },
    },
  })
  if (!inbox) return NextResponse.json({ error: "Inbox not found" }, { status: 404 })

  await prisma.vipRule.deleteMany({ where: { inboxId: inbox.id } })

  const rules = [
    ...domains.map((v: string) => ({ inboxId: inbox.id, type: "DOMAIN", value: v })),
    ...emails.map((v: string) => ({ inboxId: inbox.id, type: "EMAIL", value: v })),
    ...keywords.map((v: string) => ({ inboxId: inbox.id, type: "KEYWORD", value: v })),
  ]

  if (rules.length > 0) {
    await prisma.vipRule.createMany({ data: rules })
  }

  const updated = await prisma.vipRule.findMany({ where: { inboxId: inbox.id } })
  return NextResponse.json(updated)
}
