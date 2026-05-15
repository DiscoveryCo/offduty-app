import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import { getGmailClient, releaseEmails, stopWatch } from "@/lib/gmail"
import Stripe from "stripe"

export const runtime = "nodejs"

// Stripe requires the raw body for signature verification
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      await handleSubscriptionChange(sub)
      break
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      await handleSubscriptionDeleted(sub)
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      await handlePaymentFailed(customerId)
      break
    }
  }

  return NextResponse.json({ received: true })
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const customerId = sub.customer as string
  const status = sub.status // active | trialing | past_due | canceled | etc.
  // current_period_end exists at runtime even if newer SDK types omit it
  const rawEnd = (sub as unknown as Record<string, unknown>)["current_period_end"]
  const currentPeriodEnd = typeof rawEnd === "number" ? new Date(rawEnd * 1000) : null

  // Map Stripe status → our simplified status
  const mappedStatus =
    status === "active" ? "active"
    : status === "trialing" ? "trialing"
    : status === "past_due" ? "past_due"
    : "canceled"

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionStatus: mappedStatus,
      currentPeriodEnd,
    },
  })

}

async function handlePaymentFailed(customerId: string) {
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    include: { inboxes: true },
  })
  if (!user) return

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: "past_due" },
  })

  await Promise.allSettled(
    user.inboxes.map(async (inbox) => {
      try {
        const gmail = await getGmailClient(inbox)
        if (inbox.holdLabelId) await releaseEmails(gmail, inbox.holdLabelId)
        await stopWatch(gmail)
        await prisma.inbox.update({
          where: { id: inbox.id },
          data: { isActive: false },
        })
      } catch {
        // non-fatal
      }
    })
  )
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = sub.customer as string

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    include: { inboxes: true },
  })
  if (!user) return

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: "canceled" },
  })

  await Promise.allSettled(
    user.inboxes.map(async (inbox) => {
      try {
        const gmail = await getGmailClient(inbox)
        if (inbox.holdLabelId) await releaseEmails(gmail, inbox.holdLabelId)
        await stopWatch(gmail)
        await prisma.inbox.update({
          where: { id: inbox.id },
          data: { isActive: false },
        })
      } catch {
        // non-fatal — best effort per inbox
      }
    })
  )
}
