import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { vipRules: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json(user.vipRules)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  // body: { domains: string[], emails: string[], keywords: string[] }
  const { domains = [], emails = [], keywords = [] } = body

  await prisma.vipRule.deleteMany({ where: { userId: user.id } })

  const rules = [
    ...domains.map((v: string) => ({ userId: user.id, type: "DOMAIN", value: v })),
    ...emails.map((v: string) => ({ userId: user.id, type: "EMAIL", value: v })),
    ...keywords.map((v: string) => ({ userId: user.id, type: "KEYWORD", value: v })),
  ]

  if (rules.length > 0) {
    await prisma.vipRule.createMany({ data: rules })
  }

  const updated = await prisma.vipRule.findMany({ where: { userId: user.id } })
  return NextResponse.json(updated)
}
