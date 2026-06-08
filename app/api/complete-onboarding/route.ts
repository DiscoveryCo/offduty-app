import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // hasOnboarded was added via direct SQL migration; use raw query to set it
  await prisma.$executeRaw`
    UPDATE "User" SET "hasOnboarded" = true WHERE email = ${session.user.email}
  `

  return NextResponse.json({ ok: true })
}
