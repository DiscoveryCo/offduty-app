import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { prisma } from "@/lib/db"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.modify",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      console.log("[signIn] called, email:", user.email, "provider:", account?.provider)
      if (!user.email) { console.log("[signIn] no email, denying"); return false }
      try {
        console.log("[signIn] upserting user...")
        await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name,
            image: user.image,
            googleId: account?.providerAccountId,
            accessToken: account?.access_token,
            refreshToken: account?.refresh_token,
            tokenExpiry: account?.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
          },
          create: {
            email: user.email,
            name: user.name,
            image: user.image,
            googleId: account?.providerAccountId,
            accessToken: account?.access_token,
            refreshToken: account?.refresh_token,
            tokenExpiry: account?.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
            settings: {
              create: {},
            },
          },
        })
      } catch (err) {
        console.error("signIn DB error", err)
        return false
      }
      return true
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
