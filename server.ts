import { createServer } from "http"
import { parse } from "url"
import next from "next"
import cron from "node-cron"
import { checkAndDeliverAll, enforceTrialExpiry, renewAllWatches, enforceScheduledRemovals, purgeOldActivityLogs } from "./lib/scheduler"

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Check all active users for due deliveries every minute
  cron.schedule("* * * * *", () => {
    checkAndDeliverAll().catch(console.error)
  })

  // Release held emails and deactivate inboxes for expired trials — runs hourly
  cron.schedule("0 * * * *", () => {
    enforceTrialExpiry().catch(console.error)
    enforceScheduledRemovals().catch(console.error)
  })

  // Renew Gmail watch subscriptions daily at 3am — watches expire every 7 days
  cron.schedule("0 3 * * *", () => {
    renewAllWatches().catch(console.error)
  })

  // Purge activity logs older than 90 days — runs daily at 3:30am
  cron.schedule("30 3 * * *", () => {
    purgeOldActivityLogs().catch(console.error)
  })

  const port = parseInt(process.env.PORT ?? "3000", 10)
  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  }).listen(port, () => {
    console.log(`> Offduty ready on http://localhost:${port}`)
  })
})
