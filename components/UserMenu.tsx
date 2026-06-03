"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { ChevronDown, CreditCard, LayoutDashboard, LogOut, Settings, User } from "lucide-react"
import { logoutAction } from "@/app/actions/auth"

interface Props {
  email: string
  image: string | null
  settingsHref: string
  dashboardHref?: string
}

export function UserMenu({ email, image, settingsHref, dashboardHref = "/dashboard" }: Props) {
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
    <div ref={ref} className="relative flex items-center gap-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 hover:opacity-80 transition-opacity"
      >
        {image && <Image src={image} alt="" width={32} height={32} className="rounded-lg" />}
        <ChevronDown className="w-4 h-4 text-[#4D4D4D]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden z-50">
          <a
            href={dashboardHref}
            className="flex items-center gap-2 px-4 py-3 text-sm text-[#4D4D4D] hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </a>
          <a
            href="/account"
            className="flex items-center gap-2 px-4 py-3 text-sm text-[#4D4D4D] hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <User className="w-4 h-4" />
            Account
          </a>
          <a
            href={settingsHref}
            className="flex items-center gap-2 px-4 py-3 text-sm text-[#4D4D4D] hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <Settings className="w-4 h-4" />
            Settings
          </a>
          <a
            href="/billing"
            className="flex items-center gap-2 px-4 py-3 text-sm text-[#4D4D4D] hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <CreditCard className="w-4 h-4" />
            Billing
          </a>
          <div className="border-t border-gray-100" />
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#4D4D4D] hover:bg-gray-50 transition-colors"
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
