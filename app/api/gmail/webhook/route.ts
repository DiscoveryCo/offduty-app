import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getGmailClient, ensureHoldLabel, holdEmail, isVip } from "@/lib/gmail"
import { isAllowedToHold } from "@/lib/scheduler"

export async function POST(req: NextRequest) {
  const secret = process.env.GMAIL_WEBHOOK_SECRET
  if (secret && req.nextUrl.searchParams.get("token") !== secret) {
    console.log("webhook: token mismatch, rejecting")
    return NextResponse.json({}, { status: 401 })
  }

  try {
    const body = await req.json()
    const encoded = body?.message?.data
    if (!encoded) {
      console.log("webhook: no message data")
      return NextResponse.json({}, { status: 200 })
    }

    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"))
    const { emailAddress, historyId } = decoded
    console.log(`webhook: received for ${emailAddress}, historyId=${historyId}`)

    const inbox = await prisma.inbox.findUnique({
      where: { email: emailAddress },
      include: { vipRules: true, settings: true, user: true },
    })
    if (!inbox || !inbox.isActive) {
      console.log(`webhook: inbox not found or inactive for ${emailAddress}`)
      return NextResponse.json({}, { status: 200 })
    }
    if (!isAllowedToHold(inbox.user)) {
      console.log(`webhook: subscription not allowed for ${emailAddress}`)
      return NextResponse.json({}, { status: 200 })
    }
    if (inbox.pausedUntil && inbox.pausedUntil > new Date()) {
      console.log(`webhook: inbox paused until ${inbox.pausedUntil} for ${emailAddress}`)
      return NextResponse.json({}, { status: 200 })
    }

    const gmail = await getGmailClient(inbox)
    const holdLabelId = await ensureHoldLabel(gmail, inbox.id)

    const startHistoryId = inbox.historyId ?? String(historyId)
    const { data } = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      labelId: "INBOX",
    })

    const newMessages = data.history?.flatMap((h) => h.messagesAdded ?? []) ?? []

    for (const item of newMessages) {
      const msg = item.message
      if (!msg?.id) continue

      try {
        const full = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject"],
        })

        const headers = full.data.payload?.headers ?? []
        const from = headers.find((h) => h.name === "From")?.value ?? ""
        const subject = headers.find((h) => h.name === "Subject")?.value ?? ""
        const snippet = full.data.snippet ?? ""

        if (!isVip(from, subject, snippet, inbox.vipRules)) {
          await holdEmail(gmail, msg.id, holdLabelId)
        }
      } catch (msgErr: unknown) {
        // Message was deleted/trashed before we could process it — skip and continue
        const code = (msgErr as { code?: number })?.code
        if (code === 404) {
          console.log(`webhook: message ${msg.id} not found (deleted/trashed), skipping`)
        } else {
          console.error(`webhook: error processing message ${msg.id}`, msgErr)
        }
      }
    }

    // Always advance historyId so a bad message can never freeze the webhook
    if (data.historyId) {
      await prisma.inbox.update({
        where: { id: inbox.id },
        data: { historyId: String(data.historyId) },
      })
    }

    return NextResponse.json({}, { status: 200 })
  } catch (err) {
    console.error("webhook error", err)
    return NextResponse.json({}, { status: 200 })
  }
}
