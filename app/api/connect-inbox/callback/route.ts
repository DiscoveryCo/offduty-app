import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { google } from "googleapis"
import { cookies } from "next/headers"
import { getGmailClient, ensureHoldLabel } from "@/lib/gmail"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL))
  }

  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  const error = req.nextUrl.searchParams.get("error")

  if (error || !code) {
    return NextResponse.redirect(new URL("/dashboard?error=inbox_connect_cancelled", process.env.NEXTAUTH_URL!))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get("connect_inbox_state")?.value
  cookieStore.delete("connect_inbox_state")

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL("/dashboard?error=inbox_connect_failed", process.env.NEXTAUTH_URL!))
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/connect-inbox/callback`
  )

  try {
    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 })
    const { data: profile } = await oauth2Api.userinfo.get()

    if (!profile.email) {
      return NextResponse.redirect(new URL("/dashboard?error=inbox_connect_failed", process.env.NEXTAUTH_URL!))
    }

    const ownerUser = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!ownerUser) {
      return NextResponse.redirect(new URL("/dashboard?error=inbox_connect_failed", process.env.NEXTAUTH_URL!))
    }

    const inbox = await prisma.inbox.upsert({
      where: { email: profile.email },
      update: {
        name: profile.name,
        image: profile.picture,
        googleId: profile.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      create: {
        userId: ownerUser.id,
        email: profile.email,
        name: profile.name,
        image: profile.picture,
        googleId: profile.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isPrimary: false,
        settings: { create: {} },
      },
    })

    // Create the hold label so it's ready when the user enables holding
    const gmail = await getGmailClient(inbox)
    await ensureHoldLabel(gmail, inbox.id)

    return NextResponse.redirect(new URL(`/dashboard?inbox=${inbox.id}`, process.env.NEXTAUTH_URL!))
  } catch (err) {
    console.error("connect-inbox callback error", err)
    return NextResponse.redirect(new URL("/dashboard?error=inbox_connect_failed", process.env.NEXTAUTH_URL!))
  }
}
