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
    include: { schedules: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json(user.schedules)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  // body: Array of { dayOfWeek: number, time: string }
  const slots: { dayOfWeek: number; time: string }[] = body

  await prisma.schedule.deleteMany({ where: { userId: user.id } })
  const created = await prisma.schedule.createMany({
    data: slots.map((s) => ({ userId: user.id, dayOfWeek: s.dayOfWeek, time: s.time })),
  })

  return NextResponse.json({ count: created.count })
}
