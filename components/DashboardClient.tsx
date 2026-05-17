"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Truck, StopCircle, Play, ChevronDown, PauseCircle } from "lucide-react"
import { format, addHours, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns"

interface Props {
  isActive: boolean
  inboxId: string
  pausedUntil: string | null
}

function getPauseOptions() {
  const now = new Date()

  const fivePm = setMilliseconds(setSeconds(setMinutes(setHours(now, 17), 0), 0), 0)

  return [
    { label: "For 1 hour", until: addHours(now, 1) },
    { label: "For 2 hours", until: addHours(now, 2) },
    { label: "For 4 hours", until: addHours(now, 4) },
    ...(now.getHours() < 17 ? [{ label: "Until 5pm today", until: fivePm }] : []),
  ]
}

export function DashboardActions({ isActive: initialActive, inboxId, pausedUntil: initialPausedUntil }: Props) {
  const [isActive, setIsActive] = useState(initialActive)
  const [pausedUntil, setPausedUntil] = useState<Date | null>(
    initialPausedUntil ? new Date(initialPausedUntil) : null
  )
  const [loading, setLoading] = useState<"toggle" | "deliver" | "pause" | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [pausedDropdownOpen, setPausedDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pausedDropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const isPaused = pausedUntil && pausedUntil > new Date()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    function handleClickOutsidePaused(e: MouseEvent) {
      if (pausedDropdownRef.current && !pausedDropdownRef.current.contains(e.target as Node)) {
        setPausedDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("mousedown", handleClickOutsidePaused)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("mousedown", handleClickOutsidePaused)
    }
  }, [])

  async function handleDeliver() {
    setLoading("deliver")
    try {
      const res = await fetch("/api/deliver-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(`Delivered ${json.count} email${json.count === 1 ? "" : "s"}`)
      router.refresh()
    } catch {
      toast.error("Delivery failed")
    } finally {
      setLoading(null)
    }
  }

  async function handleToggle() {
    setLoading("toggle")
    try {
      const res = await fetch("/api/toggle-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxId }),
      })
      const json = await res.json()
      if (res.status === 403 && json.error === "subscription_required") {
        router.push("/billing")
        return
      }
      if (!res.ok) throw new Error(json.error)
      setIsActive(json.isActive)
      setPausedUntil(null)
      setPausedDropdownOpen(false)
      toast.success(json.isActive ? "Offduty started" : "Offduty stopped — inbox restored")
      router.refresh()
    } catch {
      toast.error("Failed to toggle")
    } finally {
      setLoading(null)
    }
  }

  async function handlePause(until: Date) {
    setLoading("pause")
    setDropdownOpen(false)
    try {
      const res = await fetch("/api/pause-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxId, until: until.toISOString() }),
      })
      if (!res.ok) throw new Error()
      setPausedUntil(until)
      toast.success(`Paused until ${format(until, "h:mm a")}`)
      router.refresh()
    } catch {
      toast.error("Failed to pause")
    } finally {
      setLoading(null)
    }
  }

  async function handleResume() {
    setLoading("pause")
    try {
      const res = await fetch("/api/pause-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxId, until: null }),
      })
      if (!res.ok) throw new Error()
      setPausedUntil(null)
      toast.success("Resumed — inbox is being held again")
      router.refresh()
    } catch {
      toast.error("Failed to resume")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleDeliver}
        disabled={loading !== null}
        className="flex items-center gap-2 border border-[#E5E7EB] text-[#161616] text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <Truck className="w-4 h-4" />
        Deliver Now
      </button>

      {/* Paused state */}
      {isActive && isPaused && (
        <div className="relative flex items-stretch" ref={pausedDropdownRef}>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium px-4 py-2 rounded-l-lg">
            <PauseCircle className="w-4 h-4" />
            Hold lifted until {format(pausedUntil!, "h:mm a")}
          </div>
          <button
            onClick={() => setPausedDropdownOpen((o) => !o)}
            disabled={loading !== null}
            className="flex items-center bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-medium px-2 py-2 rounded-r-lg border border-l-0 border-amber-200 transition-colors disabled:opacity-50"
            aria-label="More options"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          {pausedDropdownOpen && (
            <div className="absolute mt-1 right-0 top-full z-50 bg-[#FFFBEC] border border-amber-200 rounded-xl shadow-lg py-1 min-w-44">
              <button
                onClick={() => { setPausedDropdownOpen(false); handleResume() }}
                disabled={loading !== null}
                className="w-full text-left px-4 py-2.5 text-sm text-[#161616] hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                Resume
              </button>
              <button
                onClick={() => { setPausedDropdownOpen(false); handleToggle() }}
                disabled={loading !== null}
                className="w-full text-left px-4 py-2.5 text-sm text-[#F43F5E] hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                Stop Offduty
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active — stop + pause dropdown */}
      {isActive && !isPaused && (
        <div className="relative flex items-stretch" ref={dropdownRef}>
          <button
            onClick={handleToggle}
            disabled={loading !== null}
            className="flex items-center gap-2 bg-[#F43F5E] hover:bg-[#d93652] text-white text-sm font-medium pl-4 pr-3 py-2 rounded-l-lg transition-colors disabled:opacity-50"
          >
            <StopCircle className="w-4 h-4" />
            {loading === "toggle" ? "Stopping…" : "Stop Offduty"}
          </button>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            disabled={loading !== null}
            className="flex items-center bg-[#F43F5E] hover:bg-[#d93652] text-white text-sm font-medium px-2 py-2 rounded-r-lg border-l border-[#e0304a] transition-colors disabled:opacity-50"
            aria-label="Pause options"
          >
            <ChevronDown className="w-4 h-4" />
          </button>

          {dropdownOpen && (
            <div className="absolute mt-1 right-0 top-full z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 min-w-52">
              <p className="px-4 py-2 text-xs font-semibold text-[#4D4D4D] uppercase tracking-widest border-b border-gray-100">
                Pause holding
              </p>
              {getPauseOptions().map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => handlePause(opt.until)}
                  disabled={loading !== null}
                  className="w-full text-left px-4 py-2.5 text-sm text-[#161616] hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inactive — start button */}
      {!isActive && (
        <button
          onClick={handleToggle}
          disabled={loading !== null}
          className="flex items-center gap-2 bg-[#A78BFA] hover:bg-[#8B5CF6] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {loading === "toggle" ? "Starting…" : "Start Offduty"}
        </button>
      )}
    </div>
  )
}
