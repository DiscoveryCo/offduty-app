import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { OAuth2Client } from "google-auth-library"
import { cookies } from "next/headers"
import crypto from "crypto"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL))
  }

  const state = crypto.randomBytes(16).toString("hex")

  const cookieStore = await cookies()
  cookieStore.set("connect_inbox_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  })

  const oauth2 = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/connect-inbox/callback`
  )

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent select_account",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
    state,
  })

  return NextResponse.redirect(url)
}
