const API_BASE = "https://connect.mailerlite.com/api"

/**
 * Mirror a user's subscription status onto their MailerLite subscriber record.
 *
 * The "offduty - trial lifecycle (30 day)" automation gates each send on the
 * offduty_subscription_status field, so someone who subscribes on day 10 stops
 * receiving "your trial ends in 3 days" on day 27.
 *
 * No-ops when MAILERLITE_API_KEY is unset, so this is safe to deploy before the
 * key exists. Never throws: Stripe retries any webhook that doesn't return 2xx,
 * so a MailerLite outage must not fail the handler.
 */
export async function syncSubscriptionStatus(
  email: string,
  status: string,
): Promise<void> {
  const apiKey = process.env.MAILERLITE_API_KEY
  if (!apiKey) return

  try {
    // POST upserts — it updates the subscriber when the email already exists,
    // which it will, since signup adds them before any subscription event.
    const res = await fetch(`${API_BASE}/subscribers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        fields: { offduty_subscription_status: status },
      }),
    })

    if (!res.ok) {
      console.error(
        `[mailerlite] status sync failed for ${email}: ${res.status} ${await res.text()}`,
      )
    }
  } catch (err) {
    console.error(`[mailerlite] status sync error for ${email}:`, err)
  }
}
