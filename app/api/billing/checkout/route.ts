import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { stripe, getOrCreateCustomer } from "@/lib/stripe"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!rateLimit(`checkout:${session.user.email}`, 5, 60_000)) return tooManyRequests()

  const { priceId, quantity } = await req.json()
  if (!priceId) {
    return NextResponse.json({ error: "Missing priceId" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const customerId = await getOrCreateCustomer(
    user.email,
    user.name,
    user.stripeCustomerId,
  )

  // Persist the customer ID if it was just created
  if (!user.stripeCustomerId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    })
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: quantity ?? 1 }],
    success_url: `${baseUrl}/billing?success=1`,
    cancel_url: `${baseUrl}/billing?canceled=1`,
    allow_promotion_codes: true,
    payment_method_collection: "if_required",
    subscription_data: {
      metadata: { userId: user.id },
    },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
