# Simplification — remaining work

Phases 1–5 of the product simplification are committed. This file records what
was deliberately **not** done, and why, so the next person does not have to
reconstruct the reasoning.

## 1. Table drops — deferred until Phases 1–5 have shipped once

The code that read these tables is gone, but the tables themselves are still
defined in `shared/schema.ts` and still exist in production.

**Do not drop them in the same deploy that removes their code.** The June 2026
auth outage was schema drift on `users`; the rule since then is that a drop
migration ships at least one clean deploy *after* the code that stopped using
it, with a database backup taken first. Nothing from Phases 1–5 has been
deployed yet, so a drop migration written today would land simultaneously with
the code removal — exactly the situation the rule exists to prevent.

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

## 2. stripe-replit-sync — still required, despite looking donation-only

It is tempting to remove: donations are gone and the mirrored `stripe` schema
has no remaining reader. Two things still depend on it:

- `server/webhookHandlers.ts` calls `sync.processWebhook()` before doing its own
  verification.
- `server/index.ts` calls `findOrCreateManagedWebhook()` at boot, which is what
  registers the Stripe webhook endpoint in the first place.

Subscription correctness does **not** depend on the sync — plan changes are
applied from an independently verified event using `STRIPE_WEBHOOK_SECRET`. But
removing the boot call means the endpoint is no longer managed for you. Before
removing it: confirm in the Stripe dashboard that the endpoint exists and that
its signing secret matches `STRIPE_WEBHOOK_SECRET`, then drop the boot block,
the `getStripeSync` export, and the dependency together with the `stripe` schema.

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

This was not attempted because it is a multi-day refactor that touches the
Records sections and the event-sourcing semantics, carries real regression risk,
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
