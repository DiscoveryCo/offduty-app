"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import posthog from "posthog-js"
import { Truck, Check, ChevronDown, PlusCircle } from "lucide-react"
import { format } from "date-fns"

export interface InboxSummary {
  id: string
  email: string
  image: string | null
  isActive: boolean
  pausedUntil: string | null
  // null when the count could not be read (inbox off, or Gmail unreachable)
  heldCount: number | null
}

interface Props {
  inboxes: InboxSummary[]
  currentInboxId: string
}

// Width of the dashboard's content blocks: main is max-w-5xl (1024px) minus px-6
// on each side. The tabs never grow wider than the cards below them.
const CONTENT_WIDTH = 976
// Room kept clear on each side of the centered nav for the logo and the profile
// menu, so the nav stays truly centered rather than centered in what is left.
const SIDE_RESERVE = 140
// The header's gap-4 between its three columns.
const COLUMN_GAP = 16

// Lives in the centre of the dashboard header for users with two or more
// inboxes. When every inbox fits as a tab at full length, each tab shows its
// held count and delivers in one click; when they do not fit, it becomes the
// switcher dropdown with the same counts and Deliver buttons inside.
export function InboxNav({ inboxes, currentInboxId }: Props) {
  const [mode, setMode] = useState<"tabs" | "menu" | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const delivery = useDelivery(inboxes)

  // Measure the tabs at full length (an invisible copy) against the space the
  // header can give them, and pick a layout. Runs before paint, and again on
  // resize or when the tabs' own width changes (counts, fonts loading).
  useLayoutEffect(() => {
    const header = wrapperRef.current?.closest("header")
    const measure = measureRef.current
    if (!header || !measure) return

    const update = () => {
      const style = getComputedStyle(header)
      const inner = header.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const available = Math.min(CONTENT_WIDTH, inner - 2 * SIDE_RESERVE - 2 * COLUMN_GAP)
      setMode(measure.offsetWidth <= available ? "tabs" : "menu")
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    observer.observe(measure)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapperRef} className="flex justify-center">
      {/* Zero-size box so the full-length copy can be measured without
          affecting layout or making the page scroll sideways */}
      <div aria-hidden className="relative w-0 h-0 overflow-hidden">
        <div ref={measureRef} inert className="absolute top-0 left-0 w-max invisible">
          <InboxTabsRow inboxes={inboxes} currentInboxId={currentInboxId} delivery={delivery} />
        </div>
      </div>
      {mode === "tabs" && <InboxTabsRow inboxes={inboxes} currentInboxId={currentInboxId} delivery={delivery} />}
      {mode === "menu" && <InboxMenu inboxes={inboxes} currentInboxId={currentInboxId} delivery={delivery} />}
    </div>
  )
}

type Delivery = ReturnType<typeof useDelivery>

function useDelivery(inboxes: InboxSummary[]) {
  const [busy, setBusy] = useState<string | null>(null)
  const router = useRouter()

  const deliverable = inboxes.filter((i) => (i.heldCount ?? 0) > 0)
  const totalHeld = deliverable.reduce((sum, i) => sum + (i.heldCount ?? 0), 0)

  async function post(inboxId: string) {
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

  async function deliverOne(inbox: InboxSummary, source: "inbox_tabs" | "inbox_menu") {
    setBusy(inbox.id)
    try {
      const count = await post(inbox.id)
      posthog.capture("deliver_now", { inbox_id: inbox.id, email_count: count, source })
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

  async function deliverAll(source: "inbox_tabs" | "inbox_menu") {
    setBusy("all")
    const results = await Promise.allSettled(deliverable.map((i) => post(i.id)))
    const delivered = results.filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled")
    const count = delivered.reduce((sum, r) => sum + r.value, 0)
    const failed = results.length - delivered.length

    posthog.capture("deliver_all", { inbox_count: delivered.length, email_count: count, source })
    if (delivered.length > 0) {
      toast.success(
        `Delivered ${count} email${count === 1 ? "" : "s"} from ${delivered.length} inbox${delivered.length === 1 ? "" : "es"}`
      )
    }
    if (failed > 0) toast.error(`${failed} inbox${failed === 1 ? "" : "es"} could not be delivered`)
    router.refresh()
    setBusy(null)
  }

  return { busy, totalHeld, deliverOne, deliverAll }
}

function inboxState(inbox: InboxSummary) {
  const pausedUntil = inbox.pausedUntil ? new Date(inbox.pausedUntil) : null
  const isLifted = inbox.isActive && pausedUntil !== null && pausedUntil > new Date()
  return { held: inbox.heldCount ?? 0, isLifted, liftedUntil: isLifted ? format(pausedUntil!, "h:mm a") : null }
}

function Avatar({ inbox, size }: { inbox: InboxSummary; size: 20 | 22 }) {
  if (inbox.image) {
    return <Image src={inbox.image} alt="" width={size} height={size} className="rounded-md flex-shrink-0" />
  }
  return (
    <span
      aria-hidden
      className={`${size === 20 ? "w-5 h-5" : "w-[22px] h-[22px]"} rounded-md flex-shrink-0 bg-[#161616] text-white text-[11px] font-semibold flex items-center justify-center`}
    >
      {inbox.email[0]?.toUpperCase()}
    </span>
  )
}

function DeliverIconButton({ inbox, held, delivery, source }: { inbox: InboxSummary; held: number; delivery: Delivery; source: "inbox_tabs" | "inbox_menu" }) {
  return (
    <button
      onClick={() => delivery.deliverOne(inbox, source)}
      disabled={delivery.busy !== null}
      aria-label={`Deliver ${held} held email${held === 1 ? "" : "s"} to ${inbox.email}`}
      title="Deliver now"
      className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-white border border-[#E5E7EB] text-[#161616] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      <Truck className="w-[15px] h-[15px]" />
    </button>
  )
}

// Every inbox side by side at full length. Rendered twice: once invisibly at
// natural width for measuring, and once for real when it fits.
function InboxTabsRow({ inboxes, currentInboxId, delivery }: Props & { delivery: Delivery }) {
  return (
    <nav aria-label="Inboxes" className="flex items-center gap-1 whitespace-nowrap">
      {inboxes.map((inbox) => {
        const isCurrent = inbox.id === currentInboxId
        const { held, isLifted, liftedUntil } = inboxState(inbox)
        return (
          <div
            key={inbox.id}
            className={`flex items-center gap-1 rounded-lg pr-1 ${isCurrent ? "bg-gray-100" : "hover:bg-gray-50"}`}
          >
            <Link
              href={`/dashboard?inbox=${inbox.id}`}
              prefetch={false}
              aria-current={isCurrent ? "page" : undefined}
              className="flex items-center gap-2 h-10 pl-2 pr-1 text-sm text-[#161616]"
            >
              <Avatar inbox={inbox} size={22} />
              <span className={isCurrent ? "font-semibold" : ""}>{inbox.email}</span>
              {held > 0 && (
                <span className="text-xs font-semibold text-white bg-[#6B4FD1] rounded-full px-[7px] py-px">{held}</span>
              )}
              {isLifted && <span className="text-xs font-medium text-[#B45309]">lifted till {liftedUntil}</span>}
              {!inbox.isActive && <span className="text-xs text-[#4D4D4D]">off</span>}
            </Link>
            {held > 0 && <DeliverIconButton inbox={inbox} held={held} delivery={delivery} source="inbox_tabs" />}
          </div>
        )
      })}
      {delivery.totalHeld > 0 && (
        <button
          onClick={() => delivery.deliverAll("inbox_tabs")}
          disabled={delivery.busy !== null}
          className="ml-2 h-9 bg-[#161616] hover:bg-[#2a2a2a] text-white text-[13px] font-medium px-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {delivery.busy === "all" ? "Delivering…" : `Deliver all (${delivery.totalHeld})`}
        </button>
      )}
    </nav>
  )
}

// The fallback when the tabs do not fit: the familiar switcher, with a held
// badge on the button and each inbox's count and Deliver button inside.
function InboxMenu({ inboxes, currentInboxId, delivery }: Props & { delivery: Delivery }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = inboxes.find((i) => i.id === currentInboxId) ?? inboxes[0]

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 text-sm text-[#161616] min-h-10"
      >
        <span className="truncate max-w-[45vw] sm:max-w-none">{current?.email}</span>
        {delivery.totalHeld > 0 && (
          <span className="flex-shrink-0 text-xs font-semibold text-white bg-[#6B4FD1] rounded-full px-2 py-px">
            {delivery.totalHeld} held
          </span>
        )}
        <ChevronDown className="w-4 h-4 flex-shrink-0 text-[#4D4D4D]" />
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[400px] max-w-[calc(100vw-32px)] bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-2 text-xs text-[#4D4D4D] uppercase tracking-widest font-semibold border-b border-gray-100">
            Inboxes
          </div>
          {inboxes.map((inbox) => {
            const isCurrent = inbox.id === currentInboxId
            const { held, isLifted, liftedUntil } = inboxState(inbox)
            const status = isLifted
              ? `Hold lifted until ${liftedUntil}`
              : !inbox.isActive
                ? "Off"
                : inbox.heldCount === null
                  ? "Holding"
                  : `Holding · ${held === 0 ? "nothing held" : `${held} held`}`
            return (
              <div key={inbox.id} className="flex items-center gap-2 pr-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <Link
                  href={`/dashboard?inbox=${inbox.id}`}
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  aria-current={isCurrent ? "page" : undefined}
                  className="flex items-center gap-3 flex-1 min-w-0 pl-4 py-2.5"
                >
                  {isCurrent ? (
                    <Check className="w-4 h-4 text-[#6B4FD1] flex-shrink-0" />
                  ) : (
                    <span className="w-4 h-4 flex-shrink-0" />
                  )}
                  <Avatar inbox={inbox} size={20} />
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm text-[#161616] truncate">{inbox.email}</span>
                    <span className={`text-xs ${isLifted ? "text-[#B45309]" : "text-[#4D4D4D]"}`}>{status}</span>
                  </span>
                </Link>
                {held > 0 && <DeliverIconButton inbox={inbox} held={held} delivery={delivery} source="inbox_menu" />}
              </div>
            )
          })}
          <div className="flex items-center justify-between gap-2 px-4 py-2">
            <a
              href="/connect-inbox"
              className="flex items-center gap-3 py-1.5 text-sm text-[#4D4D4D] hover:text-[#161616] transition-colors"
              onClick={() => setOpen(false)}
            >
              <PlusCircle className="w-4 h-4 flex-shrink-0" />
              Add another inbox
            </a>
            {delivery.totalHeld > 0 && (
              <button
                onClick={() => delivery.deliverAll("inbox_menu")}
                disabled={delivery.busy !== null}
                className="h-9 bg-[#161616] hover:bg-[#2a2a2a] text-white text-[13px] font-medium px-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {delivery.busy === "all" ? "Delivering…" : `Deliver all (${delivery.totalHeld})`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
