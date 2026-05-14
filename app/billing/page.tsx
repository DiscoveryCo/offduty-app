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
        expand: ["data.items.data.price", "data.default_payment_method"],
      })
      const sub = subscriptions.data[0]
      if (sub) {
        const item = sub.items.data[0]
        const price = item.price
        const periodEnd = item.current_period_end
          ? format(new Date(item.current_period_end * 1000), "MMMM d, yyyy")
          : null

        const pm = sub.default_payment_method as import("stripe").Stripe.PaymentMethod | null
        const card = pm?.type === "card" ? pm.card : null

        subDetails = {
          planName: "DiscoveryMail",
          interval: price.recurring?.interval as "month" | "year" ?? "month",
          amount: price.unit_amount ?? 0,
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
    <div className="min-h-screen bg-[#F2F0EE] flex flex-col">
      {/* Header */}
      <header className="bg-[#FFFDFB] border-b border-[#D1D0D0] px-6 py-3 flex items-center gap-4">
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
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
            Your last payment failed. Please update your payment details to keep your
            subscription active.
          </div>
        )}
        {isCanceled && (
          <div className="bg-[#F2F0EE] border border-[#D1D0D0] text-[#4D4D4D] text-sm rounded-xl px-4 py-3 mb-6">
            Your subscription has ended. Resubscribe below to resume email holding.
          </div>
        )}

        <BillingClient
          hasActiveSubscription={hasActiveSubscription}
          stripeCustomerId={user.stripeCustomerId ?? null}
          monthlyPriceId={process.env.STRIPE_PRICE_MONTHLY!}
          annualPriceId={process.env.STRIPE_PRICE_ANNUAL!}
          subDetails={subDetails}
        />
      </main>

      <footer className="border-t border-[#D1D0D0] py-6 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#A78BFA]" />
          <span className="text-sm font-semibold text-[#161616]">DiscoveryMail</span>
        </div>
        <span className="text-xs text-[#4D4D4D]">© {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
