"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import posthog from "posthog-js"
import { Truck, Plus } from "lucide-react"
import { format } from "date-fns"

export interface InboxTab {
  id: string
  email: string
  image: string | null
  isActive: boolean
  pausedUntil: string | null
  // null when the count could not be read (inbox off, or Gmail unreachable)
  heldCount: number | null
}

interface Props {
  inboxes: InboxTab[]
  currentInboxId: string
}

// Shown on the dashboard when a user has two or more inboxes. Each tab shows
// that inbox's held count and delivers it in one click, so checking and
// releasing another inbox no longer means switching to it first.
export function InboxTabs({ inboxes, currentInboxId }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const router = useRouter()
  const now = new Date()

  const deliverable = inboxes.filter((i) => (i.heldCount ?? 0) > 0)
  const totalHeld = deliverable.reduce((sum, i) => sum + (i.heldCount ?? 0), 0)

  async function deliver(inboxId: string) {
    const res = await fetch("/api/deliver-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inboxId }),
    })
    if (res.status === 429) throw new Error("rate_limited")
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    return json.count as number
  }

  async function deliverOne(inbox: InboxTab) {
    setBusy(inbox.id)
    try {
      const count = await deliver(inbox.id)
      posthog.capture("deliver_now", { inbox_id: inbox.id, email_count: count, source: "inbox_tabs" })
      toast.success(`Delivered ${count} email${count === 1 ? "" : "s"} to ${inbox.email}`)
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error && err.message === "rate_limited"
          ? "Too many requests — please wait a moment and try again."
          : "Delivery failed"
      )
    } finally {
      setBusy(null)
    }
  }

  async function deliverAll() {
    setBusy("all")
    const results = await Promise.allSettled(deliverable.map((i) => deliver(i.id)))
    const delivered = results.filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled")
    const count = delivered.reduce((sum, r) => sum + r.value, 0)
    const failed = results.length - delivered.length

    posthog.capture("deliver_all", { inbox_count: delivered.length, email_count: count })
    if (delivered.length > 0) {
      toast.success(
        `Delivered ${count} email${count === 1 ? "" : "s"} from ${delivered.length} inbox${delivered.length === 1 ? "" : "es"}`
      )
    }
    if (failed > 0) toast.error(`${failed} inbox${failed === 1 ? "" : "es"} could not be delivered`)
    router.refresh()
    setBusy(null)
  }

  return (
    <nav aria-label="Inboxes" className="bg-white border-b border-[#E5E7EB] px-6">
      <div className="flex items-center gap-2">
        {/* Scrolls sideways when the tabs outgrow the width, without a visible
            scrollbar. The fade marks the edge so a cut-off tab reads as "more". */}
        <div className="relative flex-1 min-w-0">
        <div className="flex items-stretch gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-6">
          {inboxes.map((inbox) => {
            const isCurrent = inbox.id === currentInboxId
            const held = inbox.heldCount ?? 0
            const pausedUntil = inbox.pausedUntil ? new Date(inbox.pausedUntil) : null
            const isLifted = inbox.isActive && pausedUntil !== null && pausedUntil > now

            return (
              <div
                key={inbox.id}
                // Full addresses while they fit; tabs then shrink (truncating the
                // address) down to 180px, and the row scrolls beyond that.
                className={`flex items-center gap-0.5 min-w-[180px] border-b-2 ${
                  isCurrent ? "border-[#161616]" : "border-transparent"
                }`}
              >
                <Link
                  href={`/dashboard?inbox=${inbox.id}`}
                  prefetch={false}
                  aria-current={isCurrent ? "page" : undefined}
                  title={inbox.email}
                  className="flex items-center gap-2 min-w-0 min-h-12 pl-1 pr-1.5 text-sm text-[#161616]"
                >
                  {inbox.image ? (
                    <Image src={inbox.image} alt="" width={22} height={22} className="rounded-md flex-shrink-0" />
                  ) : (
                    <span
                      aria-hidden
                      className="w-[22px] h-[22px] rounded-md flex-shrink-0 bg-[#161616] text-white text-[11px] font-semibold flex items-center justify-center"
                    >
                      {inbox.email[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className={`truncate ${isCurrent ? "font-semibold" : ""}`}>{inbox.email}</span>
                  {held > 0 && (
                    <span className="flex-shrink-0 text-xs font-semibold text-white bg-[#6B4FD1] rounded-full px-[7px] py-px">
                      {held}
                    </span>
                  )}
                  {isLifted && (
                    <span className="flex-shrink-0 text-xs font-medium text-[#B45309]">
                      lifted till {format(pausedUntil!, "h:mm a")}
                    </span>
                  )}
                  {!inbox.isActive && <span className="flex-shrink-0 text-xs text-[#4D4D4D]">off</span>}
                </Link>
                {held > 0 ? (
                  <button
                    onClick={() => deliverOne(inbox)}
                    disabled={busy !== null}
                    aria-label={`Deliver ${held} held email${held === 1 ? "" : "s"} to ${inbox.email}`}
                    title="Deliver now"
                    className="w-8 h-8 mr-2.5 flex-shrink-0 flex items-center justify-center border border-[#E5E7EB] text-[#161616] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <Truck className="w-[15px] h-[15px]" />
                  </button>
                ) : (
                  <span aria-hidden className="w-2.5" />
                )}
              </div>
            )
          })}
          <Link
            href="/connect-inbox"
            aria-label="Add another inbox"
            title="Add another inbox"
            className="flex items-center justify-center min-w-10 min-h-12 text-[#4D4D4D] hover:text-[#161616] flex-shrink-0 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </Link>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent" />
        </div>
        {totalHeld > 0 ? (
          <button
            onClick={deliverAll}
            disabled={busy !== null}
            aria-label={`Deliver all ${totalHeld} held emails`}
            className="flex-shrink-0 flex items-center gap-1.5 min-h-9 bg-[#161616] hover:bg-[#2a2a2a] text-white text-[13px] font-medium px-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {/* Icon and count only on phones, so the tabs keep their width */}
            <Truck className="w-[15px] h-[15px] sm:hidden" />
            <span className="sm:hidden">{totalHeld}</span>
            <span className="hidden sm:inline">{busy === "all" ? "Delivering…" : `Deliver all (${totalHeld})`}</span>
          </button>
        ) : (
          <span className="flex-shrink-0 text-[13px] text-[#4D4D4D]">All caught up</span>
        )}
      </div>
    </nav>
  )
}
