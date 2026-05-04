"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { ChevronDown, LogOut } from "lucide-react"

interface Props {
  email: string
  image: string | null
}

export function UserMenu({ email, image }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div ref={ref} className="relative flex items-center gap-2 text-sm text-slate-300">
      {image && <Image src={image} alt="" width={28} height={28} className="rounded-full" />}
      <span>{email}</span>
      <button
        onClick={() => setOpen(!open)}
        className="text-slate-500 hover:text-slate-300 ml-1"
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-[#2a2d40] border border-white/10 rounded-xl shadow-lg overflow-hidden z-50">
          <form
            action={async () => {
              const { signOut } = await import("next-auth/react")
              await signOut({ callbackUrl: "/login" })
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
