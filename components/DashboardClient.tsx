"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Truck, StopCircle, Play } from "lucide-react"

interface Props {
  isActive: boolean
  userEmail: string
}

export function DashboardActions({ isActive: initialActive, userEmail }: Props) {
  const [isActive, setIsActive] = useState(initialActive)
  const [loading, setLoading] = useState<"toggle" | "deliver" | null>(null)
  const router = useRouter()

  async function handleDeliver() {
    setLoading("deliver")
    try {
      const res = await fetch("/api/deliver-now", { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(`Delivered ${json.count} email${json.count === 1 ? "" : "s"}`)
      router.refresh()
    } catch (e) {
      toast.error("Delivery failed")
    } finally {
      setLoading(null)
    }
  }

  async function handleToggle() {
    setLoading("toggle")
    try {
      const res = await fetch("/api/toggle-active", { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setIsActive(json.isActive)
      toast.success(json.isActive ? "DiscoveryMail started" : "DiscoveryMail stopped — inbox restored")
      router.refresh()
    } catch (e) {
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
        className="flex items-center gap-2 border border-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
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
            : "bg-[#7c7cf8] hover:bg-[#6b6be7]"
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
