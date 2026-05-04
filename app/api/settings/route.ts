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
    include: { settings: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json(user.settings ?? {})
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  const { dndEnabled, dndFrom, dndTo, scheduleType, intervalHours, timesPerDay } = body

  const settings = await prisma.settings.upsert({
    where: { userId: user.id },
    update: { dndEnabled, dndFrom, dndTo, scheduleType, intervalHours, timesPerDay },
    create: {
      userId: user.id,
      dndEnabled: dndEnabled ?? false,
      dndFrom,
      dndTo,
      scheduleType: scheduleType ?? "custom_weekly",
      intervalHours,
      timesPerDay,
    },
  })

  return NextResponse.json(settings)
}
