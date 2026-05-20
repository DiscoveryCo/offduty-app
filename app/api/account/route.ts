import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getGmailClient, releaseEmails, stopWatch, revokeAccess } from "@/lib/gmail"
import { stripe } from "@/lib/stripe"

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { inboxes: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Cancel any active Stripe subscription immediately
  if (user.stripeCustomerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        limit: 1,
      })
      if (subscriptions.data.length > 0) {
        await stripe.subscriptions.cancel(subscriptions.data[0].id)
      }
    } catch {
      // non-fatal — continue with deletion
    }
  }

  // Release all held emails and stop watches before deleting
  for (const inbox of user.inboxes) {
    try {
      const gmail = await getGmailClient(inbox)
      if (inbox.holdLabelId) await releaseEmails(gmail, inbox.holdLabelId)
      await stopWatch(gmail)
      await revokeAccess(inbox)
    } catch {
      // non-fatal — continue
    }
  }

  // Delete all child records explicitly before deleting the user,
  // in case database-level cascades were not applied via migration.
  const inboxIds = user.inboxes.map((i) => i.id)
  await prisma.activityLog.deleteMany({ where: { inboxId: { in: inboxIds } } })
  await prisma.vipRule.deleteMany({ where: { inboxId: { in: inboxIds } } })
  await prisma.schedule.deleteMany({ where: { inboxId: { in: inboxIds } } })
  await prisma.settings.deleteMany({ where: { inboxId: { in: inboxIds } } })
  await prisma.inbox.deleteMany({ where: { id: { in: inboxIds } } })
  await prisma.user.delete({ where: { id: user.id } })

  return NextResponse.json({ ok: true })
}
