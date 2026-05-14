"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Props {
  page: number
  pages: number
}

export function ActivityPagination({ page, pages }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function go(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(p))
    router.push(`/dashboard?${params.toString()}`)
  }

  if (pages <= 1) return null

  const pageNumbers: (number | "...")[] = []
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) pageNumbers.push(i)
  } else {
    pageNumbers.push(1)
    if (page > 3) pageNumbers.push("...")
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) {
      pageNumbers.push(i)
    }
    if (page < pages - 2) pageNumbers.push("...")
    pageNumbers.push(pages)
  }

  return (
    <div className="flex items-center gap-1 mt-6 justify-center">
      <button
        onClick={() => go(page - 1)}
        disabled={page === 1}
        className="p-1.5 rounded hover:bg-[#F2F0EE] disabled:opacity-30 text-[#4D4D4D]"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pageNumbers.map((n, i) =>
        n === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-[#4D4D4D] text-sm">
            …
          </span>
        ) : (
          <button
            key={n}
            onClick={() => go(n as number)}
            className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
              n === page
                ? "bg-[#A78BFA] text-white"
                : "text-[#4D4D4D] hover:bg-[#F2F0EE]"
            }`}
          >
            {n}
          </button>
        )
      )}
      <button
        onClick={() => go(page + 1)}
        disabled={page === pages}
        className="p-1.5 rounded hover:bg-[#F2F0EE] disabled:opacity-30 text-[#4D4D4D]"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
