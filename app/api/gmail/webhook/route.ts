import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getGmailClient, ensureHoldLabel, holdEmail, isVip } from "@/lib/gmail"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const encoded = body?.message?.data
    if (!encoded) return NextResponse.json({}, { status: 200 })

    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"))
    const { emailAddress, historyId } = decoded

    const user = await prisma.user.findUnique({
      where: { email: emailAddress },
      include: { vipRules: true, settings: true },
    })
    if (!user || !user.isActive) return NextResponse.json({}, { status: 200 })

    const gmail = await getGmailClient(user)
    const holdLabelId = await ensureHoldLabel(gmail, user.id)

    const startHistoryId = user.historyId ?? String(historyId)
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

      if (!isVip(from, subject, snippet, user.vipRules)) {
        await holdEmail(gmail, msg.id, holdLabelId)
      }
    }

    // Update stored historyId to the latest one
    if (data.historyId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { historyId: String(data.historyId) },
      })
    }

    return NextResponse.json({}, { status: 200 })
  } catch (err) {
    console.error("webhook error", err)
    // Always 200 so Pub/Sub doesn't retry infinitely on bad data
    return NextResponse.json({}, { status: 200 })
  }
}
