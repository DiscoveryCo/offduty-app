import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const PAGE_SIZE = 15

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10)
  const skip = (page - 1) * PAGE_SIZE

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where: { userId: user.id },
      orderBy: { deliveredAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where: { userId: user.id } }),
  ])

  return NextResponse.json({
    logs,
    total,
    pages: Math.ceil(total / PAGE_SIZE),
    page,
  })
}
