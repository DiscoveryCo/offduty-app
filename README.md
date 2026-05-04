# DiscoveryMail

Self-hosted Gmail batching app. Holds incoming emails and releases them in scheduled batches — you decide when email reaches you, not the sender.

## How it works

1. Sign in with Google. DiscoveryMail requests `gmail.modify` access.
2. Click **Start DiscoveryMail** — it creates a `DiscoveryMail-Hold` label in Gmail and registers a push notification via Google Cloud Pub/Sub.
3. As emails arrive, Gmail pushes a notification to the webhook. DiscoveryMail checks VIP rules — non-VIP emails are silently moved to the hold label.
4. At your scheduled delivery times, the cron scheduler moves all held emails back to your inbox at once.
5. **Deliver Now** releases everything immediately. **Stop** releases everything and deactivates the hold.

## Setup

### 1. Install dependencies

```bash
# Requires Node 22+
/opt/homebrew/opt/node@22/bin/npm install
```

### 2. Google Cloud setup

Enable the **Gmail API** and **Pub/Sub API** in a Google Cloud project.

**OAuth credentials:**
1. APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application)
2. Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`
3. Copy Client ID and Client Secret

**Pub/Sub:**
1. Create a topic, e.g. `discoverymail`
2. Create a **push subscription** pointing to: `https://yourdomain.com/api/gmail/webhook`
3. Grant the Gmail push service account publisher access:
   ```bash
   gcloud pubsub topics add-iam-policy-binding discoverymail \
     --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
     --role="roles/pubsub.publisher"
   ```

> **Local dev:** Use [ngrok](https://ngrok.com) to expose port 3000 and use the HTTPS URL as your Pub/Sub push endpoint.

### 3. Configure environment

Fill in `.env.local`:

```env
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=                        # openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_PUBSUB_TOPIC=projects/{project}/topics/discoverymail
```

`DATABASE_URL` in `.env` is already set to SQLite (`file:./prisma/dev.db`).

### 4. Push the database schema

```bash
/opt/homebrew/opt/node@22/bin/npm run db:push
```

### 5. Run

```bash
/opt/homebrew/opt/node@22/bin/npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your Google account.

## Features

- **Scheduled delivery** — interval, N times/day, custom daily, or custom weekly schedule
- **VIP bypass** — domains, email addresses, keywords that always arrive instantly
- **Do Not Disturb** — block deliveries during a time window (e.g. overnight)
- **Deliver Now** — release all held emails immediately
- **Start / Stop** — toggle the hold on/off (stopping always releases held mail)
- **Activity log** — paginated history of every delivery batch

## Tech stack

- Next.js 16 (App Router) + TypeScript
- NextAuth v5 (Google OAuth)
- Prisma 7 + SQLite (better-sqlite3)
- Gmail API via `googleapis`
- node-cron for delivery scheduling (custom server.ts)
- Tailwind CSS
