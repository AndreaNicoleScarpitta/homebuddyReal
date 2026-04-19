# GA4 Setup for Home Buddy Agents

Home Buddy's agents (founder brief, SEO performance, SEO content writer, landing copy) can pull live Google Analytics 4 data. When GA4 isn't configured, every helper returns empty data silently — nothing breaks, you just don't get the traffic insights.

This guide wires up GA4 read access via a Google Cloud service account.

---

## Prerequisites

- A GA4 property already receiving traffic from `home-buddy.replit.app` (or wherever the app is hosted)
- Owner/Admin access to the GA4 property
- A Google Cloud project (free tier is fine)

---

## Step 1 — Create a service account

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Pick (or create) a project — e.g. `home-buddy-analytics`.
3. Go to **IAM & Admin → Service Accounts → Create Service Account**.
4. Name it `homebuddy-ga4-reader`. No roles needed at the project level.
5. Click **Done**.

## Step 2 — Create a JSON key

1. Click the service account you just made.
2. Go to **Keys → Add Key → Create new key → JSON**.
3. A `.json` file downloads — keep it safe, this is the credential.

## Step 3 — Enable the GA4 Data API

1. In Cloud Console, go to **APIs & Services → Library**.
2. Search for **Google Analytics Data API**.
3. Click **Enable**.

## Step 4 — Grant the service account read access in GA4

1. Open [Google Analytics](https://analytics.google.com/) → **Admin** (gear icon).
2. Under **Property**, click **Property Access Management**.
3. Click the **+** button → **Add users**.
4. Paste the service account email (it looks like `homebuddy-ga4-reader@home-buddy-analytics.iam.gserviceaccount.com`).
5. Give it the **Viewer** role. Uncheck "Notify by email".
6. Click **Add**.

## Step 5 — Find your property ID

1. In GA4 **Admin → Property Settings**, find **Property ID** (a 9-digit number).
2. You'll use this as `GA4_PROPERTY_ID`. The app auto-prefixes `properties/` if you leave it off.

## Step 6 — Set the env vars

Add these to your deployment environment (Replit Secrets, `.env`, or wherever you manage env):

```bash
GA4_PROPERTY_ID=123456789
GA4_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"...",...}'
```

**Important:** `GA4_SERVICE_ACCOUNT_JSON` must be the **entire JSON file contents as a single-line string**. On most platforms you can paste it as-is (quotes and all). On Windows cmd you may need to escape quotes.

## Step 7 — Verify

Restart the server and check the logs. You should **NOT** see:

```
GA4 not configured (GA4_PROPERTY_ID + GA4_SERVICE_ACCOUNT_JSON). GA4 helpers will return empty data.
```

Trigger the founder brief agent manually from `/admin/agents` (or wait for 7am UTC). The email should now include a "Traffic & SEO (last 7 days)" section with real numbers.

---

## What the agents use GA4 for

| Agent | What it pulls | What it does with it |
|---|---|---|
| `founder-brief-agent` | Summary, top pages, traffic sources, signup-funnel | Daily 7am email — adds "Traffic & SEO" section + anomaly alerts (session drop WoW, high bounce pages) |
| `seo-performance-agent` | Top pages, WoW comparison, sources | Weekly Mon 8am email — decaying pages, surging pages, high-bounce pages, leaky guides with recommendations |
| `seo-content-agent` | Top guides, decaying guides | Writes new articles in the style of what ranks; can pick the worst-decaying guide to refresh |
| `landing-copy-agent` | Landing page metrics, top traffic sources | Generates A/B variants that address the real failure mode (e.g. high bounce = hero isn't hooking) |

---

## Troubleshooting

**"Permission denied" errors in the agent logs**
The service account isn't attached to the GA4 property. Redo Step 4.

**"API not enabled" errors**
Redo Step 3. The GA4 Data API must be enabled in the same GCP project as the service account.

**Empty data even though config looks right**
Check that the property ID matches your actual GA4 property (not a Universal Analytics view ID). GA4 property IDs are 9-digit numbers, no dashes.

**JSON parse error at startup**
Your `GA4_SERVICE_ACCOUNT_JSON` env got mangled by shell escaping. Wrap it in single quotes, or use the platform's secret manager which handles it raw.

---

## Cost

The GA4 Data API is free up to generous quotas (25k tokens/day for most properties). The agents make at most ~20 requests/day. You will not hit limits.
