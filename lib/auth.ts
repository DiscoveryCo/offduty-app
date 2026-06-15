import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { prisma } from "@/lib/db"
import { encryptToken } from "@/lib/crypto"

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
      if (!user.email) return false
      try {
        const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name,
            image: user.image,
            googleId: account?.providerAccountId,
          },
          create: {
            email: user.email,
            name: user.name,
            image: user.image,
            googleId: account?.providerAccountId,
            subscriptionStatus: "trialing",
            trialEndsAt,
          },
        })

        const isNewUser = Date.now() - dbUser.createdAt.getTime() < 10_000
        if (isNewUser && process.env.N8N_WEBHOOK_URL) {
          fetch(process.env.N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email, name: user.name }),
          }).catch(() => {})
        }

        await prisma.inbox.upsert({
          where: { email: user.email },
          update: {
            name: user.name,
            image: user.image,
            googleId: account?.providerAccountId,
            accessToken: account?.access_token ? encryptToken(account.access_token) : undefined,
            refreshToken: account?.refresh_token ? encryptToken(account.refresh_token) : undefined,
            tokenExpiry: account?.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
          },
          create: {
            userId: dbUser.id,
            email: user.email,
            name: user.name,
            image: user.image,
            googleId: account?.providerAccountId,
            accessToken: account?.access_token ? encryptToken(account.access_token) : undefined,
            refreshToken: account?.refresh_token ? encryptToken(account.refresh_token) : undefined,
            tokenExpiry: account?.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
            isPrimary: true,
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
