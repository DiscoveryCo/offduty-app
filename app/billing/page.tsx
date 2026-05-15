function calculateGraduatedTotal(
  tiers: { up_to: number | null; unit_amount: number | null; flat_amount: number | null }[],
  quantity: number
): number {
  let total = 0
  let prev = 0
  for (const tier of tiers) {
    const tierEnd = tier.up_to ?? Infinity
    const unitsInTier = Math.min(quantity, tierEnd) - prev
    if (unitsInTier <= 0) break
    total += (tier.unit_amount ?? 0) * unitsInTier + (tier.flat_amount ?? 0)
    prev = tierEnd
    if (prev >= quantity) break
  }
  return total
}

import { redirect } from "next/navigation"
import Link from "next/link"
import { Mail, ArrowLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { format } from "date-fns"
import { BillingClient } from "@/components/BillingClient"
import { UserMenu } from "@/components/UserMenu"

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>
}) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      inboxes: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
    },
  })
  if (!user) redirect("/login")

  const params = await searchParams
  const showSuccess = params.success === "1"
  const showCanceled = params.canceled === "1"

  const status = user.subscriptionStatus ?? "trialing"
  const isTrialing = status === "trialing"
  const isCanceled = status === "canceled"
  const isPastDue = status === "past_due"
  const hasActiveSubscription = status === "active"

  const trialEndFormatted = user.trialEndsAt ? format(user.trialEndsAt, "MMMM d, yyyy") : null

  // Fetch live subscription details from Stripe if subscribed
  let subDetails: {
    planName: string
    interval: "month" | "year"
    amount: number
    periodEnd: string
    cancelAtPeriodEnd: boolean
    cardBrand: string | null
    cardLast4: string | null
  } | null = null

  if (hasActiveSubscription && user.stripeCustomerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        limit: 1,
        expand: ["data.items.data.price", "data.default_payment_method", "data.discounts.coupon"],
      })
      const sub = subscriptions.data[0]
      if (sub) {
        const item = sub.items.data[0]
        const price = item.price
        const quantity = item.quantity ?? 1
        const periodEnd = item.current_period_end
          ? format(new Date(item.current_period_end * 1000), "MMMM d, yyyy")
          : null

        const pm = sub.default_payment_method as import("stripe").Stripe.PaymentMethod | null
        const card = pm?.type === "card" ? pm.card : null

        // Use the upcoming invoice for the exact amount — handles all pricing models
        // (flat, graduated, volume) and applies discounts automatically
        let totalAmount = 0
        try {
          const upcoming = await stripe.invoices.createPreview({
            customer: user.stripeCustomerId,
          })
          totalAmount = upcoming.total
        } catch {
          // Fall back to unit_amount if upcoming invoice unavailable
          totalAmount = (price.unit_amount ?? 0) * quantity
        }

        subDetails = {
          planName: "DiscoveryMail",
          interval: price.recurring?.interval as "month" | "year" ?? "month",
          amount: totalAmount,
          periodEnd: periodEnd ?? "",
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          cardBrand: card?.brand ?? null,
          cardLast4: card?.last4 ?? null,
        }
      }
    } catch {
      // non-fatal — fall back to basic view
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-[#4D4D4D] hover:text-[#4D4D4D]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-75 transition-opacity">
          <Mail className="w-5 h-5 text-[#A78BFA]" />
          <span className="font-bold text-lg tracking-tight text-[#161616]">DiscoveryMail</span>
        </Link>
        <div className="ml-auto">
          <UserMenu email={user.email} image={user.image ?? null} settingsHref="/settings" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 flex-1 w-full">
        <h1 className="text-2xl font-bold text-[#161616] mb-6">Billing</h1>

        {/* Flash messages */}
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-4">
            You&apos;re subscribed! Your DiscoveryMail subscription is now active.
          </div>
        )}
        {showCanceled && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3 mb-4">
            Checkout was canceled. You haven&apos;t been charged.
          </div>
        )}

        {/* Status banners */}
        {isTrialing && trialEndFormatted && (
          <div className="bg-[#ededff] text-[#5b5bd6] text-sm rounded-xl px-4 py-3 mb-6">
            Your free trial ends on <strong>{trialEndFormatted}</strong>. If you enjoy
            newly-found sanity in your inbox, consider upgrading to a paid plan to enjoy
            uninterrupted sanity.
          </div>
        )}
        {isPastDue && (
          <div className="bg-[#fff1f3] border border-[#fda4af] text-[#be1d37] text-sm rounded-xl px-4 py-3 mb-6">
            Your last payment failed. Please update your payment details to keep your
            subscription active.
          </div>
        )}
        {isCanceled && (
          <div className="bg-gray-50 border border-[#E5E7EB] text-[#4D4D4D] text-sm rounded-xl px-4 py-3 mb-6">
            Your subscription has ended. Resubscribe below to resume email holding.
          </div>
        )}

        <BillingClient
          hasActiveSubscription={hasActiveSubscription}
          stripeCustomerId={user.stripeCustomerId ?? null}
          monthlyPriceId={process.env.STRIPE_PRICE_MONTHLY!}
          annualPriceId={process.env.STRIPE_PRICE_ANNUAL!}
          subDetails={subDetails}
          inboxCount={user.inboxes.length}
        />
      </main>

      <footer className="border-t border-[#E5E7EB] py-6 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#A78BFA]" />
          <span className="text-sm font-semibold text-[#161616]">DiscoveryMail</span>
        </div>
        <span className="text-xs text-[#4D4D4D]">© {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
