"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Check, PlusCircle } from "lucide-react"
import Image from "next/image"

interface Inbox {
  id: string
  email: string
  image: string | null
}

interface Props {
  inboxes: Inbox[]
  currentInboxId: string
  hrefPrefix?: string
}

export function InboxSwitcher({ inboxes, currentInboxId, hrefPrefix = "/dashboard?inbox=" }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const current = inboxes.find((i) => i.id === currentInboxId) ?? inboxes[0]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function switchInbox(id: string) {
    setOpen(false)
    window.location.href = hrefPrefix + id
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
      >
        <span>{current?.email}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-2 text-xs text-gray-400 uppercase tracking-widest font-semibold border-b border-gray-100">
            Inboxes
          </div>
          {inboxes.map((inbox) => (
            <button
              key={inbox.id}
              onClick={() => switchInbox(inbox.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              {inbox.id === currentInboxId ? (
                <Check className="w-4 h-4 text-[#7c7cf8] flex-shrink-0" />
              ) : (
                <span className="w-4 h-4 flex-shrink-0" />
              )}
              {inbox.image ? (
                <Image src={inbox.image} alt="" width={20} height={20} className="rounded-md flex-shrink-0" />
              ) : (
                <span className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="text-sm text-gray-700 truncate">{inbox.email}</span>
            </button>
          ))}
          <div className="border-t border-gray-100">
            <a
              href="/connect-inbox"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              <PlusCircle className="w-4 h-4 flex-shrink-0" />
              Add another inbox
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
