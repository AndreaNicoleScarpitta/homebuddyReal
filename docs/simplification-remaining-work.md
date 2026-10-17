# Simplification — remaining work

This is a historical debt list; check today's routes and deployed model before acting.
Phases 1–5 of product simplification have been deployed. This file records what
was deliberately **not** done, and why, so the next person does not have to
reconstruct the reasoning.

## 1. Table drops — deferred until Phases 1–5 have shipped once

The code that read these tables is gone, but the tables themselves are still
defined in `shared/schema.ts` and still exist in production.

**Do not drop them in the same deploy that removes their code.** The June 2026
auth outage was schema drift on `users`; the rule since then is that a drop
migration ships at least one clean deploy *after* the code that stopped using
it, with a database backup taken first. The releases have since deployed, but no table drop is safe without a new search for readers, tested migrations, a current backup, and a separate compatibility review.

Drop list, once Phases 1–5 are live and stable:

| Table | Removed by | Notes |
|---|---|---|
| `funds`, `fund_allocations`, `expenses` | Phase 1 (budget) | `deleteAllUserData` in `server/storage.ts` still purges these; remove that block in the same change as the drop |
| `conversations`, `messages` | Phase 1 (replit chat) | never registered on the app |
| `chat_messages` | legacy chat | confirm the v2 `projection_chat_*` tables are the only live path first |
| `user_actions`, `outcome_events`, `learning_adjustments` | Phase 4 (learning loop) | |
| `agents`, `agent_runs`, `agent_outputs` | Phase 5 (agent suite) | |
| `stripe` schema (whole schema) | see §2 | only with the stripe-replit-sync removal |

Write each cluster as its own reviewed migration with `DROP TABLE IF EXISTS`,
per the workflow in CLAUDE.md. Take a backup before each.

## 2. Stripe legacy sync — opt-in, **not needed for donations**

New paid subscriptions were discontinued and **one-time donations are available** through `server/billing-routes.ts`. `server/index.ts` no longer runs the legacy Stripe auto-sync unless `STRIPE_SYNC_ENABLED=1`. Donation checkout uses the Stripe SDK directly; it worked in production on October 17 after a new live key was configured.

Do **not** re-enable sync by default or drop the historical `stripe` schema / `stripe-replit-sync` package casually. `server/webhookHandlers.ts` and any existing subscribers/customer portal require a separate audit of the endpoint, signing secret, event processing and cancellation paths. Remove legacy integration only in a dedicated, reviewed migration with an existing-subscriber plan.

## 3. Legacy `/api` vs `/v2` — smaller than it looked, but real

The original assessment called this "two parallel API stacks". After Phase 1
deleted the funds/expenses CRUD, most of what remains under `/api` is
cross-cutting and legitimately belongs there: auth, billing, uploads, CSRF,
disclaimer, contact, `me/*`. Those should stay.

What is genuinely duplicated — the same resource implemented twice:

- `/api/home` and `/v2/home`
- `/api/home/:homeId/systems` and `/v2/homes/:homeId/systems`
- `/api/home/:homeId/tasks` and `/v2/homes/:homeId/tasks`
- `/api/home/:homeId/reports` and `/v2/homes/:homeId/reports`
- `/api/home/:homeId/warranties` and `/v2/homes/:homeId/warranties`
- `/api/tasks/:id` and `/v2/tasks/:taskId`
- `/api/notifications/preferences` and `/v2/notifications/preferences`

Utilities and insurance exist **only** on `/api` — there is no v2 equivalent, so
consolidating those means writing new v2 endpoints, not just re-pointing calls.

This was not attempted because it is a multi-day refactor that touches legacy data and UI sections and the event-sourcing semantics, carries real regression risk,
and delivers nothing a user can see. Do it deliberately, one resource at a time,
each with its own tests — not as a sweep.

## 4. Gated on usage data

`/intelligence`, `/timeline` and `/transfer-kit` are still routed and still
linked from the secondary nav. Retiring them was always conditional on 30-day
`page_view` counts from GA4, which are not available from this machine
(`GA4_PROPERTY_ID` / `GA4_SERVICE_ACCOUNT_JSON` are unset). Pull those before
deciding. The threshold proposed was: under ~5% of weekly actives in 30 days.

The calendar page (`/calendar`) and the calendar card on `/profile` are two
implementations of the same job. The page is better — it has one-click
Google/Apple/Outlook buttons — and is now linked from Plan. Consolidate onto it.
