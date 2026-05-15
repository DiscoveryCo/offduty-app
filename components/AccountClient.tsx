"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { signOut } from "next-auth/react"
import { Trash2, X } from "lucide-react"

interface Inbox {
  id: string
  email: string
  name: string | null
  image: string | null
  isActive: boolean
  isPrimary: boolean
  isPaidSeat: boolean
  scheduledRemovalAt: string | null
}

// ── Remove a single non-primary inbox ──────────────────────────────────────

export function RemoveInboxButton({ inbox }: { inbox: Inbox }) {
  const [mode, setMode] = useState<"idle" | "confirm-deactivate" | "confirm-remove">("idle")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDeactivate() {
    setLoading(true)
    try {
      const res = await fetch("/api/billing/remove-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxId: inbox.id }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${inbox.email} will be removed at the end of your billing period`)
      router.refresh()
    } catch {
      toast.error("Failed to deactivate inbox")
    } finally {
      setLoading(false)
      setMode("idle")
    }
  }

  async function handleRemove() {
    setLoading(true)
    try {
      const url = inbox.isPaidSeat
        ? `/api/inbox?inboxId=${inbox.id}&force=true`
        : `/api/inbox?inboxId=${inbox.id}`
      const res = await fetch(url, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(`${inbox.email} removed`)
      router.refresh()
    } catch {
      toast.error("Failed to remove inbox")
    } finally {
      setLoading(false)
      setMode("idle")
    }
  }

  // Scheduled for removal — just show status
  if (inbox.scheduledRemovalAt) {
    return (
      <span className="text-xs text-amber-600">Removing at period end</span>
    )
  }

  if (mode === "confirm-deactivate") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#4D4D4D]">Remove at period end?</span>
        <button
          onClick={handleDeactivate}
          disabled={loading}
          className="text-xs bg-[#F43F5E] hover:bg-[#d93652] text-white px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Removing…" : "Confirm"}
        </button>
        <button onClick={() => setMode("idle")} className="text-[#4D4D4D] hover:text-[#4D4D4D]">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  if (mode === "confirm-remove") {
    return (
      <div className="flex flex-col items-end gap-2">
        <p className="text-xs text-[#4D4D4D] text-right max-w-[200px]">
          {inbox.isPaidSeat
            ? "Removes now. No refund for this period."
            : "Remove this inbox?"}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRemove}
            disabled={loading}
            className="text-xs bg-[#F43F5E] hover:bg-[#d93652] text-white px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Removing…" : "Yes, remove"}
          </button>
          <button onClick={() => setMode("idle")} className="text-[#4D4D4D] hover:text-[#4D4D4D]">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  if (inbox.isPaidSeat) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode("confirm-deactivate")}
          className="text-xs text-[#4D4D4D] hover:text-amber-600 transition-colors"
        >
          Deactivate
        </button>
        <span className="text-[#E5E7EB]">·</span>
        <button
          onClick={() => setMode("confirm-remove")}
          className="text-xs text-[#4D4D4D] hover:text-[#F43F5E] transition-colors"
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setMode("confirm-remove")}
      className="text-xs text-[#4D4D4D] hover:text-[#F43F5E] transition-colors"
    >
      Remove
    </button>
  )
}

// ── Delete entire account ───────────────────────────────────────────────────

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (input !== "DELETE") return
    setLoading(true)
    try {
      const res = await fetch("/api/account", { method: "DELETE" })
      if (!res.ok) throw new Error()
      await signOut({ callbackUrl: "/login" })
    } catch {
      toast.error("Failed to delete account")
      setLoading(false)
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-2 bg-[#fff1f3] hover:bg-red-100 text-[#d93652] border border-[#fda4af] text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Permanently Delete Account
      </button>
    )
  }

  return (
    <div className="space-y-3 p-4 bg-[#fff1f3] border border-[#fda4af] rounded-xl">
      <p className="text-sm text-[#be1d37]">
        This will release all held emails, remove all your data, and cannot be undone.
        Type <strong>DELETE</strong> to confirm.
      </p>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type DELETE to confirm"
        className="w-full border border-[#fda4af] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
      />
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={input !== "DELETE" || loading}
          className="bg-[#F43F5E] hover:bg-[#d93652] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
        >
          {loading ? "Deleting…" : "Delete my account"}
        </button>
        <button
          onClick={() => { setConfirming(false); setInput("") }}
          className="border border-[#E5E7EB] text-[#4D4D4D] text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
