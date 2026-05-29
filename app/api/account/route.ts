import { NextResponse, after } from "next/server"
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

  // Cancel any active Stripe subscription immediately. Billing matters, so this
  // is done synchronously (it's fast) before we confirm deletion to the user.
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

  // Capture inbox data (including tokens) before deletion so the background
  // Gmail cleanup below can still authenticate after the rows are gone.
  const inboxes = user.inboxes
  const inboxIds = inboxes.map((i) => i.id)

  // Delete all data synchronously and return quickly. This is the part that
  // matters for "delete my account", and keeping it fast avoids the proxy
  // timeout that previously surfaced a misleading error in the browser.
  // Child records are deleted explicitly in case DB-level cascades were not
  // applied via migration.
  await prisma.activityLog.deleteMany({ where: { inboxId: { in: inboxIds } } })
  await prisma.vipRule.deleteMany({ where: { inboxId: { in: inboxIds } } })
  await prisma.schedule.deleteMany({ where: { inboxId: { in: inboxIds } } })
  await prisma.settings.deleteMany({ where: { inboxId: { in: inboxIds } } })
  await prisma.inbox.deleteMany({ where: { id: { in: inboxIds } } })
  await prisma.user.delete({ where: { id: user.id } })

  // Release held emails, stop Gmail watches, and revoke OAuth access as a
  // best-effort background task after the response is sent. These are slow
  // Gmail API calls that should not block (or fail) the deletion response.
  after(async () => {
    for (const inbox of inboxes) {
      try {
        const gmail = await getGmailClient(inbox)
        if (inbox.holdLabelId) await releaseEmails(gmail, inbox.holdLabelId)
        await stopWatch(gmail)
        await revokeAccess(inbox)
      } catch {
        // non-fatal — the account is already deleted
      }
    }
  })

  return NextResponse.json({ ok: true })
}
