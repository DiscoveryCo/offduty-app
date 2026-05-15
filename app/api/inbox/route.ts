import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getGmailClient, releaseEmails, stopWatch } from "@/lib/gmail"
import { stripe } from "@/lib/stripe"

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const inboxId = req.nextUrl.searchParams.get("inboxId")
  const force = req.nextUrl.searchParams.get("force") === "true"
  if (!inboxId) return NextResponse.json({ error: "inboxId required" }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { inboxes: true },
  })
  const inbox = user?.inboxes.find((i) => i.id === inboxId)
  if (!inbox) return NextResponse.json({ error: "Inbox not found" }, { status: 404 })
  if (inbox.isPrimary) return NextResponse.json({ error: "Cannot remove primary inbox" }, { status: 400 })

  const isPaidSeat = user?.subscriptionStatus === "active" && !inbox.scheduledRemovalAt

  if (isPaidSeat && !force) {
    return NextResponse.json({ error: "billing_required" }, { status: 409 })
  }

  // For a force-deleted paid seat, decrement Stripe quantity (no proration — no refund)
  if (isPaidSeat && force && user?.stripeCustomerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        limit: 1,
      })
      const sub = subscriptions.data[0]
      if (sub) {
        const currentPaidCount = user.inboxes.filter((i) => !i.scheduledRemovalAt).length
        const newQuantity = Math.max(1, currentPaidCount - 1)
        await stripe.subscriptionItems.update(sub.items.data[0].id, {
          quantity: newQuantity,
          proration_behavior: "none",
        })
      }
    } catch (err) {
      console.error("inbox DELETE: failed to decrement Stripe quantity", err)
      // non-fatal — proceed with deletion
    }
  }

  try {
    const gmail = await getGmailClient(inbox)
    if (inbox.holdLabelId) await releaseEmails(gmail, inbox.holdLabelId)
    await stopWatch(gmail)
  } catch {
    // non-fatal — continue with deletion
  }

  await prisma.inbox.delete({ where: { id: inboxId } })
  return NextResponse.json({ ok: true })
}
