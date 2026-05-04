import { google } from "googleapis"
import { prisma } from "@/lib/db"
import type { User, VipRule } from "@/lib/generated/prisma/client"

const HOLD_LABEL_NAME = "DiscoveryMail-Hold"

function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  )
}

export async function getGmailClient(user: User) {
  const oauth2 = buildOAuth2Client()
  oauth2.setCredentials({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
    expiry_date: user.tokenExpiry ? user.tokenExpiry.getTime() : undefined,
  })

  oauth2.on("tokens", async (tokens) => {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        accessToken: tokens.access_token ?? user.accessToken,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : user.tokenExpiry,
      },
    })
  })

  return google.gmail({ version: "v1", auth: oauth2 })
}

export async function ensureHoldLabel(
  gmail: ReturnType<typeof google.gmail>,
  userId: string
): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { holdLabelId: true },
  })
  if (existing?.holdLabelId) return existing.holdLabelId

  const { data } = await gmail.users.labels.list({ userId: "me" })
  const found = data.labels?.find((l) => l.name === HOLD_LABEL_NAME)
  if (found?.id) {
    await prisma.user.update({ where: { id: userId }, data: { holdLabelId: found.id } })
    return found.id
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
  await prisma.user.update({ where: { id: userId }, data: { holdLabelId: labelId } })
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
  const { data } = await gmail.users.messages.list({
    userId: "me",
    labelIds: [holdLabelId],
    maxResults: 500,
  })
  const messages = data.messages ?? []
  if (messages.length === 0) return 0

  await gmail.users.messages.batchModify({
    userId: "me",
    requestBody: {
      ids: messages.map((m) => m.id!),
      addLabelIds: ["INBOX"],
      removeLabelIds: [holdLabelId],
    },
  })
  return messages.length
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
  userId: string
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

  await prisma.user.update({
    where: { id: userId },
    data: {
      historyId: data.historyId ? String(data.historyId) : undefined,
      watchExpiry: data.expiration ? new Date(Number(data.expiration)) : undefined,
    },
  })
}

export async function stopWatch(gmail: ReturnType<typeof google.gmail>) {
  await gmail.users.stop({ userId: "me" }).catch(() => {})
}

export async function getHeldCount(
  gmail: ReturnType<typeof google.gmail>,
  holdLabelId: string
): Promise<number> {
  const { data } = await gmail.users.messages.list({
    userId: "me",
    labelIds: [holdLabelId],
    maxResults: 500,
  })
  return data.messages?.length ?? 0
}
