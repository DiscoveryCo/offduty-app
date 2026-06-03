"use client"

import { useState } from "react"
import { Check, Star, CreditCard, RefreshCw, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"

const FEATURES_MONTHLY = [
  "Hold your inbox",
  "Multiple inbox support",
  "Activity logs",
  "Custom delivery scheduling",
  "VIP lists",
  "Custom Do-Not-Disturb periods",
]

const FEATURES_ANNUAL_EXTRA = [
  "20% savings vs monthly",
  "One invoice per year",
]

interface SubDetails {
  interval: "month" | "year"
  periodEnd: string
  cancelAtPeriodEnd: boolean
  cardBrand: string | null
  cardLast4: string | null
}

interface Props {
  hasActiveSubscription: boolean
  stripeCustomerId: string | null
  monthlyPriceId: string
  annualPriceId: string
  subDetails: SubDetails | null
  inboxCount: number
}

export function BillingClient({
  hasActiveSubscription,
  stripeCustomerId,
  monthlyPriceId,
  annualPriceId,
  subDetails,
  inboxCount,
}: Props) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly")
  const [loading, setLoading] = useState<null | "checkout" | "updateCard" | "invoices" | "adjustPlan" | "cancel" | "resume">(null)
  const [confirming, setConfirming] = useState(false)
  const router = useRouter()

  async function handleChoosePlan() {
    setLoading("checkout")
    try {
      const priceId = billing === "monthly" ? monthlyPriceId : annualPriceId
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, quantity: inboxCount }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed")
      setLoading(null)
      window.location.href = data.url
    } catch {
      toast.error("Could not start checkout. Please try again.")
      setLoading(null)
    }
  }

  async function handleUpdateCard() {
    setLoading("updateCard")
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow: "payment_method_update" }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed")
      setLoading(null)
      window.location.href = data.url
    } catch {
      toast.error("Could not open card update. Please try again.")
      setLoading(null)
    }
  }

  async function handleViewInvoices() {
    setLoading("invoices")
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed")
      setLoading(null)
      window.location.href = data.url
    } catch {
      toast.error("Could not open billing portal. Please try again.")
      setLoading(null)
    }
  }

  async function handleAdjustPlan() {
    setLoading("adjustPlan")
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed")
      setLoading(null)
      window.location.href = data.url
    } catch {
      toast.error("Could not open billing portal. Please try again.")
      setLoading(null)
    }
  }

  async function handleCancel() {
    setLoading("cancel")
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" })
      if (!res.ok) throw new Error()
      toast.success("Subscription will cancel at the end of the billing period.")
      setConfirming(false)
      router.refresh()
    } catch {
      toast.error("Could not cancel subscription. Please try again.")
    } finally {
      setLoading(null)
    }
  }

  async function handleResume() {
    setLoading("resume")
    try {
      const res = await fetch("/api/billing/resume", { method: "POST" })
      if (!res.ok) throw new Error()
      toast.success("Subscription resumed.")
      router.refresh()
    } catch {
      toast.error("Could not resume subscription. Please try again.")
    } finally {
      setLoading(null)
    }
  }

  // ── Active subscription view ──────────────────────────────────────────────
  if (hasActiveSubscription) {
    const intervalLabel = subDetails?.interval === "year" ? "Annual" : "Monthly"

    return (
      <div className="space-y-4">
        {/* Plan card */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
          <h2 className="font-semibold text-[#161616] mb-4">Plan</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#161616] font-medium">
                offduty — {intervalLabel}
              </p>
              {subDetails && (
                <p className="text-sm mt-1" style={{ color: subDetails.cancelAtPeriodEnd ? "#d97706" : "#4D4D4D" }}>
                  {subDetails.cancelAtPeriodEnd
                    ? `Expires ${subDetails.periodEnd}`
                    : `Renews ${subDetails.periodEnd}`}
                </p>
              )}
              <p className="text-xs text-[#4D4D4D] mt-2">
                {inboxCount} inbox{inboxCount !== 1 ? "es" : ""} connected.{" "}
                <Link href="/account" className="text-[#A78BFA] hover:underline">
                  Manage inboxes
                </Link>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {subDetails?.cancelAtPeriodEnd ? (
                <button
                  onClick={handleAdjustPlan}
                  disabled={loading === "adjustPlan"}
                  className="text-sm bg-[#ededff] hover:bg-[#dcdcff] text-[#A78BFA] font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {loading === "adjustPlan" ? "Loading…" : "Resume membership"}
                </button>
              ) : confirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4D4D4D]">Cancel at period end?</span>
                  <button
                    onClick={handleCancel}
                    disabled={loading === "cancel"}
                    className="text-xs bg-[#F43F5E] hover:bg-[#d93652] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading === "cancel" ? "Canceling…" : "Yes, cancel"}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="text-xs text-[#4D4D4D] hover:text-[#4D4D4D] transition-colors"
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAdjustPlan}
                  disabled={loading === "adjustPlan"}
                  className="text-sm bg-[#ededff] hover:bg-[#dcdcff] text-[#A78BFA] font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {loading === "adjustPlan" ? "Loading…" : "Adjust Plan"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
          <h2 className="font-semibold text-[#161616] mb-4">Payment Method</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#4D4D4D] text-sm">
              <CreditCard className="w-4 h-4" />
              {subDetails?.cardBrand && subDetails?.cardLast4 ? (
                <span className="capitalize">{subDetails.cardBrand} •••• {subDetails.cardLast4}</span>
              ) : (
                <span>Managed securely via Stripe</span>
              )}
            </div>
            <button
              onClick={handleUpdateCard}
              disabled={loading === "updateCard"}
              className="text-sm bg-[#ededff] hover:bg-[#dcdcff] text-[#A78BFA] font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {loading === "updateCard" ? "Loading…" : "Update card"}
            </button>
          </div>
        </div>

        {/* Invoice history */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
          <h2 className="font-semibold text-[#161616] mb-4">Invoice History</h2>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#4D4D4D]">View and download past invoices.</p>
            <button
              onClick={handleViewInvoices}
              disabled={loading === "invoices"}
              className="text-sm bg-[#ededff] hover:bg-[#dcdcff] text-[#A78BFA] font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading === "invoices" ? "Loading…" : "View invoices"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── No subscription — show pricing ───────────────────────────────────────
  const additionalInboxes = Math.max(0, inboxCount - 1)
  const monthlyTotal = (4.99 + additionalInboxes * 3.49).toFixed(2)
  const annualTotal = (47.99 + additionalInboxes * 33.59).toFixed(2)
  const displayPrice = billing === "monthly" ? monthlyTotal : (parseFloat(annualTotal) / 12).toFixed(2)
  const allFeatures = billing === "annual"
    ? [...FEATURES_MONTHLY, ...FEATURES_ANNUAL_EXTRA]
    : FEATURES_MONTHLY

  return (
    <div className="max-w-sm mx-auto">
      <p className="text-xs text-[#4D4D4D] text-center mb-4 italic">All prices are in USD.</p>

      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm">
        <h3 className="text-xl font-bold text-[#161616] text-center mb-4">Offduty</h3>

        {/* Price */}
        <div className="text-center mb-4">
          <div className="flex items-start justify-center gap-1">
            <span className="text-sm text-[#4D4D4D] mt-2">$</span>
            <span className="text-6xl font-bold text-[#A78BFA] leading-none">{displayPrice}</span>
            <span className="text-sm text-[#A78BFA] mt-auto mb-1">per month</span>
          </div>
          {billing === "annual" && (
            <p className="text-xs text-[#4D4D4D] mt-1">billed as ${annualTotal}/year</p>
          )}
          {inboxCount > 1 && (
            <p className="text-xs text-[#4D4D4D] mt-1">
              {billing === "monthly"
                ? `$4.99 base + $3.49 × ${additionalInboxes} additional inbox${additionalInboxes > 1 ? "es" : ""} (30% off)`
                : `$47.99 base + $33.59 × ${additionalInboxes} additional inbox${additionalInboxes > 1 ? "es" : ""} (30% off)`}
            </p>
          )}
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <button
            onClick={() => setBilling("annual")}
            className={`text-sm px-4 py-1.5 rounded-full font-medium transition-colors ${
              billing === "annual"
                ? "bg-[#A78BFA] text-white"
                : "text-[#A78BFA] hover:bg-[#ededff]"
            }`}
          >
            Yearly
          </button>
          <button
            onClick={() => setBilling("monthly")}
            className={`text-sm px-4 py-1.5 rounded-full font-medium transition-colors ${
              billing === "monthly"
                ? "bg-[#A78BFA] text-white"
                : "text-[#A78BFA] hover:bg-[#ededff]"
            }`}
          >
            Monthly
          </button>
        </div>

        {/* Feature list */}
        <ul className="space-y-2.5 mb-6">
          {allFeatures.map((feature, i) => {
            const isBonus = billing === "annual" && i >= FEATURES_MONTHLY.length
            return (
              <li key={feature} className="flex items-center gap-2.5">
                {isBonus ? (
                  <Star className="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-[#ededff] flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-[#A78BFA]" strokeWidth={3} />
                  </div>
                )}
                <span className="text-sm text-[#4D4D4D]">{feature}</span>
              </li>
            )
          })}
        </ul>

        <button
          onClick={handleChoosePlan}
          disabled={loading !== null}
          className="w-full bg-[#A78BFA] hover:bg-[#6b6be0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading === "checkout" ? "Loading…" : "Choose Plan"}
        </button>
      </div>
    </div>
  )
}
