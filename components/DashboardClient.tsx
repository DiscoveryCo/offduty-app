"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Truck, StopCircle, Play } from "lucide-react"

interface Props {
  isActive: boolean
  inboxId: string
}

export function DashboardActions({ isActive: initialActive, inboxId }: Props) {
  const [isActive, setIsActive] = useState(initialActive)
  const [loading, setLoading] = useState<"toggle" | "deliver" | null>(null)
  const router = useRouter()

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
      toast.success(json.isActive ? "DiscoveryMail started" : "DiscoveryMail stopped — inbox restored")
      router.refresh()
    } catch {
      toast.error("Failed to toggle")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleDeliver}
        disabled={loading !== null}
        className="flex items-center gap-2 border border-[#D1D0D0] text-[#161616] text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#F2F0EE] transition-colors disabled:opacity-50"
      >
        <Truck className="w-4 h-4" />
        Deliver Now
      </button>
      <button
        onClick={handleToggle}
        disabled={loading !== null}
        className={`flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
          isActive
            ? "bg-red-500 hover:bg-red-600"
            : "bg-[#A78BFA] hover:bg-[#8B5CF6]"
        }`}
      >
        {isActive ? (
          <>
            <StopCircle className="w-4 h-4" />
            Stop DiscoveryMail
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Start DiscoveryMail
          </>
        )}
      </button>
    </div>
  )
}
