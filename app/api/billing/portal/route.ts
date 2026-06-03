import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { stripe } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 404 })
  }

  const { flow } = await req.json().catch(() => ({ flow: null }))
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

  let flowData: Parameters<typeof stripe.billingPortal.sessions.create>[0]["flow_data"] | undefined

  if (flow === "payment_method_update") {
    flowData = { type: "payment_method_update" }
  } else if (flow === "subscription_update") {
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      limit: 1,
    })
    const subId = subscriptions.data[0]?.id
    if (subId) {
      flowData = {
        type: "subscription_update",
        subscription_update: { subscription: subId },
      }
    }
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/billing`,
    ...(flowData && { flow_data: flowData }),
  })

  return NextResponse.json({ url: portalSession.url })
}
