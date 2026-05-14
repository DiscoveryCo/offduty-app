"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

interface Props {
  heldCount: number
  isActive: boolean
}

export function HeldEmailsCard({ heldCount, isActive }: Props) {
  const [hidden, setHidden] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setHidden(localStorage.getItem("heldCountHidden") === "true")
  }, [])

  function toggle() {
    const next = !hidden
    setHidden(next)
    localStorage.setItem("heldCountHidden", String(next))
  }

  async function refresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 600)
  }

  return (
    <div className="bg-[#FFFDFB] border border-[#D1D0D0] rounded-xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-[#4D4D4D] uppercase tracking-widest">Held Emails</p>
        {isActive && (
          <button onClick={refresh} className="text-[#4D4D4D] hover:text-[#4D4D4D] transition-colors" title="Refresh count">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
      {isActive ? (
        hidden ? (
          <p className="text-sm text-[#4D4D4D]">Count hidden.</p>
        ) : (
          <p className="text-sm text-[#4D4D4D] leading-relaxed">
            <strong className="text-[#161616] text-2xl">{heldCount}</strong>{" "}
            {heldCount === 1 ? "email is" : "emails are"} currently held back from your inbox.
          </p>
        )
      ) : (
        <p className="text-sm text-[#4D4D4D]">
          DiscoveryMail is off. Start it to begin holding emails.
        </p>
      )}
      {isActive && (
        <button
          onClick={toggle}
          className="text-[#A78BFA] text-sm mt-2 inline-block hover:underline"
        >
          {hidden ? "Show count" : "Hide count"}
        </button>
      )}
    </div>
  )
}
