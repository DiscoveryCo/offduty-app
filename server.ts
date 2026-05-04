import { createServer } from "http"
import { parse } from "url"
import next from "next"
import cron from "node-cron"
import { checkAndDeliverAll } from "./lib/scheduler"

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Check all active users for due deliveries every minute
  cron.schedule("* * * * *", () => {
    checkAndDeliverAll().catch(console.error)
  })

  // Renew gmail.watch() subscriptions daily at 3am
  cron.schedule("0 3 * * *", async () => {
    const { prisma } = await import("./lib/db")
    const { getGmailClient, registerWatch } = await import("./lib/gmail")
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        watchExpiry: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      },
    })
    for (const user of users) {
      const gmail = await getGmailClient(user)
      await registerWatch(gmail, user.id).catch(console.error)
    }
  })

  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  }).listen(3000, () => {
    console.log("> DiscoveryMail ready on http://localhost:3000")
  })
})
