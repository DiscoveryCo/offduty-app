import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { stripe } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { inboxId } = await req.json().catch(() => ({}))
  if (!inboxId) return NextResponse.json({ error: "Missing inboxId" }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { inboxes: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (!user.stripeCustomerId) return NextResponse.json({ error: "No Stripe customer" }, { status: 400 })

  const inbox = user.inboxes.find((i) => i.id === inboxId)
  if (!inbox) return NextResponse.json({ error: "Inbox not found" }, { status: 404 })
  if (inbox.isPrimary) return NextResponse.json({ error: "Cannot remove primary inbox" }, { status: 400 })

  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: "active",
    limit: 1,
  })
  const sub = subscriptions.data[0]
  if (!sub) return NextResponse.json({ error: "No active subscription found" }, { status: 400 })

  const rawEnd = (sub as unknown as Record<string, unknown>)["current_period_end"]
  const periodEnd = typeof rawEnd === "number" ? new Date(rawEnd * 1000) : new Date()

  const currentPaidCount = user.inboxes.filter((i) => !i.scheduledRemovalAt).length
  const newQuantity = Math.max(1, currentPaidCount - 1)

  await stripe.subscriptionItems.update(sub.items.data[0].id, {
    quantity: newQuantity,
    proration_behavior: "none",
  })

  await prisma.inbox.update({
    where: { id: inboxId },
    data: { scheduledRemovalAt: periodEnd },
  })

  return NextResponse.json({ scheduledRemovalAt: periodEnd.toISOString() })
}
