import { google } from "googleapis"
import { prisma } from "@/lib/db"
import type { Inbox, VipRule } from "@/lib/generated/prisma/client"
import { decryptToken, encryptToken } from "@/lib/crypto"

const HOLD_LABEL_NAME = "Offduty-Hold"
const LEGACY_HOLD_LABEL_NAME = "DiscoveryMail-Hold"

const oauthClientCache = new Map<string, InstanceType<typeof google.auth.OAuth2>>()

function getOAuth2Client(inbox: Inbox) {
  const accessToken = inbox.accessToken ? decryptToken(inbox.accessToken) : null
  const refreshToken = inbox.refreshToken ? decryptToken(inbox.refreshToken) : null

  const cached = oauthClientCache.get(inbox.id)
  if (cached) {
    cached.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: inbox.tokenExpiry ? inbox.tokenExpiry.getTime() : undefined,
    })
    return cached
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  )
  oauth2.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: inbox.tokenExpiry ? inbox.tokenExpiry.getTime() : undefined,
  })
  oauth2.on("tokens", async (tokens) => {
    try {
      await prisma.inbox.update({
        where: { id: inbox.id },
        data: {
          accessToken: tokens.access_token ? encryptToken(tokens.access_token) : inbox.accessToken,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : inbox.tokenExpiry,
        },
      })
    } catch {
      // Inbox may have been deleted (e.g. during account deletion) — ignore.
    }
  })
  oauthClientCache.set(inbox.id, oauth2)
  return oauth2
}

export async function getGmailClient(inbox: Inbox) {
  const oauth2 = getOAuth2Client(inbox)
  return google.gmail({ version: "v1", auth: oauth2 })
}

export async function ensureHoldLabel(
  gmail: ReturnType<typeof google.gmail>,
  inboxId: string
): Promise<string> {
  const existing = await prisma.inbox.findUnique({
    where: { id: inboxId },
    select: { holdLabelId: true },
  })
  if (existing?.holdLabelId) return existing.holdLabelId

  const { data } = await gmail.users.labels.list({ userId: "me" })
  const found = data.labels?.find((l) => l.name === HOLD_LABEL_NAME)
  if (found?.id) {
    await prisma.inbox.update({ where: { id: inboxId }, data: { holdLabelId: found.id } })
    return found.id
  }

  // Migrate legacy label if present — Gmail renames in place, no emails lost
  const legacy = data.labels?.find((l) => l.name === LEGACY_HOLD_LABEL_NAME)
  if (legacy?.id) {
    await gmail.users.labels.update({
      userId: "me",
      id: legacy.id,
      requestBody: { name: HOLD_LABEL_NAME },
    })
    await prisma.inbox.update({ where: { id: inboxId }, data: { holdLabelId: legacy.id } })
    return legacy.id
  }

  const created = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: HOLD_LABEL_NAME,
      labelListVisibility: "labelShow",
      messageListVisibility: "hide",
    },
  })
  const labelId = created.data.id!
  await prisma.inbox.update({ where: { id: inboxId }, data: { holdLabelId: labelId } })
  return labelId
}

export async function holdEmail(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string,
  holdLabelId: string
) {
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      addLabelIds: [holdLabelId],
      removeLabelIds: ["INBOX"],
    },
  })
}

export async function releaseEmails(
  gmail: ReturnType<typeof google.gmail>,
  holdLabelId: string
): Promise<number> {
  let total = 0
  let pageToken: string | undefined

  do {
    const { data } = await gmail.users.messages.list({
      userId: "me",
      labelIds: [holdLabelId],
      maxResults: 500,
      ...(pageToken ? { pageToken } : {}),
    })

    const messages = data.messages ?? []
    if (messages.length > 0) {
      await gmail.users.messages.batchModify({
        userId: "me",
        requestBody: {
          ids: messages.map((m) => m.id!),
          addLabelIds: ["INBOX"],
          removeLabelIds: [holdLabelId],
        },
      })
      total += messages.length
    }

    pageToken = data.nextPageToken ?? undefined
  } while (pageToken)

  return total
}

export function isVip(
  from: string,
  subject: string,
  snippet: string,
  vipRules: VipRule[]
): boolean {
  for (const rule of vipRules) {
    const val = rule.value.toLowerCase()
    if (rule.type === "EMAIL" && from.toLowerCase().includes(val)) return true
    if (rule.type === "DOMAIN" && from.toLowerCase().includes(`@${val}`)) return true
    if (
      rule.type === "KEYWORD" &&
      (subject.toLowerCase().includes(val) || snippet.toLowerCase().includes(val))
    )
      return true
  }
  return false
}

export async function registerWatch(
  gmail: ReturnType<typeof google.gmail>,
  inboxId: string
) {
  const topic = process.env.GOOGLE_PUBSUB_TOPIC
  if (!topic) throw new Error("GOOGLE_PUBSUB_TOPIC not set")

  const { data } = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: topic,
      labelIds: ["INBOX"],
      labelFilterBehavior: "INCLUDE",
    },
  })

  await prisma.inbox.update({
    where: { id: inboxId },
    data: {
      historyId: data.historyId ? String(data.historyId) : undefined,
      watchExpiry: data.expiration ? new Date(Number(data.expiration)) : undefined,
    },
  })
}

export async function stopWatch(gmail: ReturnType<typeof google.gmail>) {
  await gmail.users.stop({ userId: "me" }).catch(() => {})
}

export async function revokeAccess(inbox: Inbox) {
  try {
    const oauth2 = getOAuth2Client(inbox)
    const raw = inbox.refreshToken ?? inbox.accessToken
    const token = raw ? decryptToken(raw) : null
    if (token) await oauth2.revokeToken(token)
  } catch {
    // non-fatal — token may already be expired or revoked by the user
  }
}

export async function getHeldCount(
  gmail: ReturnType<typeof google.gmail>,
  holdLabelId: string
): Promise<number> {
  let total = 0
  let pageToken: string | undefined

  do {
    const { data } = await gmail.users.messages.list({
      userId: "me",
      labelIds: [holdLabelId],
      maxResults: 500,
      ...(pageToken ? { pageToken } : {}),
    })
    total += data.messages?.length ?? 0
    pageToken = data.nextPageToken ?? undefined
  } while (pageToken)

  return total
}
