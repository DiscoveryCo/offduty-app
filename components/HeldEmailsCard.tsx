"use client"

import { useState, useEffect } from "react"

interface Props {
  heldCount: number
  isActive: boolean
}

export function HeldEmailsCard({ heldCount, isActive }: Props) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setHidden(localStorage.getItem("heldCountHidden") === "true")
  }, [])

  function toggle() {
    const next = !hidden
    setHidden(next)
    localStorage.setItem("heldCountHidden", String(next))
  }

  return (
    <div className="bg-[#242740] rounded-xl p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
        Held Emails
      </p>
      {isActive ? (
        hidden ? (
          <p className="text-sm text-slate-500">Count hidden.</p>
        ) : (
          <p className="text-sm text-slate-300 leading-relaxed">
            <strong className="text-white text-2xl">{heldCount}</strong>{" "}
            {heldCount === 1 ? "email is" : "emails are"} currently held back from your inbox.
          </p>
        )
      ) : (
        <p className="text-sm text-slate-500">
          DiscoveryMail is off. Start it to begin holding emails.
        </p>
      )}
      {isActive && (
        <button
          onClick={toggle}
          className="text-[#7c7cf8] text-sm mt-2 inline-block hover:underline"
        >
          {hidden ? "Show count" : "Hide count"}
        </button>
      )}
    </div>
  )
}
