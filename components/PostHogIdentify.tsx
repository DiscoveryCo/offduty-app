"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

export function PostHogIdentify({ email }: { email: string }) {
  useEffect(() => {
    posthog.identify(email, { email })
  }, [email])
  return null
}
