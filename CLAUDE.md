# Home Buddy

## Quick Start (Local Development on Windows)

```bash
# Start PostgreSQL (Docker)
docker start homebuddy-postgres
# Or create fresh: docker run -d --name homebuddy-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=home_buddy -p 5433:5432 postgres:16
# NOTE: host port 5433 on purpose — another project (afarensis-db) claims 5432 on this
# machine. When something else owns the port, `docker start` binds NOTHING silently and
# the app connects to the wrong postgres ("password authentication failed").

# Set env vars and run
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/home_buddy"
export PORT=5000
export NODE_ENV=development
npx tsx server/index.ts
```

App runs at http://localhost:5000. Login with test/password123.

## Architecture

- **Backend**: Express + TypeScript, PostgreSQL with Drizzle ORM, event-sourced architecture
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + Radix UI, Wouter router
- **AI**: OpenAI GPT-4o (document analysis, task suggestions, chat)
- **Auth**: Replit OIDC (production) + test login (local dev)
- **Session**: PostgreSQL via connect-pg-simple

## Key Paths

- `server/index.ts` — Server entry point
- `server/routes.ts` — Legacy API routes (`/api`) — auth, billing, uploads, and some domain CRUD
- `server/routes_v2.ts` — V2 event-sourced API routes (`/v2`) — the preferred home for domain work
- `server/db.ts` — Database connection (Pool + Drizzle)
- `shared/schema.ts` — Drizzle schema (all tables)
- `client/src/App.tsx` — Client routing & auth gate
- `client/src/pages/` — Page components
- `vite.config.ts` — Vite build config (root: client/, aliases: @/*, @shared/*, @assets/*)
- `drizzle.config.ts` — Drizzle Kit config
- `docs/simplification-remaining-work.md` — deferred table drops, the stripe-replit-sync trap, and the `/api` vs `/v2` duplication list. **Read before dropping tables or "tidying" the Stripe boot path.**

## Product shape

Four primary surfaces: **Home** (dashboard), **Plan** (maintenance log), **Systems**, **Records**.
Records is one page with a `?type=` filter covering documents, warranties, insurance and utilities;
the old `/documents`, `/warranties`, `/insurance` and `/utilities` URLs redirect into it.
Document analysis is an action on Home, not a nav tab. Ask AI, Insights, Timeline and
Transfer Kit sit in a secondary group pending a usage review.

Monetization is a single subscription: Free and Plus. Premium is unlisted and its checkout
is closed because it sells multiple homes, which the app does not support (`/v2/home`
returns one home and there is no switcher). Donations were removed entirely.

## Commands

- `npm run dev` — Full-stack dev (requires NODE_ENV=development set separately on Windows)
- `npm run build` — Production build (client to dist/public, server to dist/index.cjs)
- `npm run start` — Run production build
- `npm run db:migrate` — Apply migration files (the deploy path: CI and the Dockerfile CMD both use this; self-baselines existing databases)
- `npm run db:push` — Dev-only schema sync. WARNING: push DROPS anything not in shared/schema.ts, including the hand-written CHECK/FK constraints and it can't create the event_log trigger — after a local push, run `npm run db:migrate` to restore them. Never use push in prod/CI.
- `npm run check` — TypeScript check

## Schema Changes

1. Edit `shared/schema.ts` (or `shared/models/*`)
2. `npx drizzle-kit generate --name <description>` — creates a reviewed SQL file in `migrations/`
3. Review the generated SQL, commit it; deploys apply it via `db:migrate`
For constraints/triggers drizzle can't model, use `npx drizzle-kit generate --custom --name <description>` and write idempotent SQL (see migrations/0001–0003 for the pattern; use `NOT VALID` on constraints so legacy prod rows can't block a deploy).

## Windows-Specific Notes

- `reusePort` removed from server listen (ENOTSUP on Windows)
- `npm run dev` script uses inline `NODE_ENV=development` which doesn't work on Windows cmd; use `export` in bash or set env vars separately
- Replit OIDC disabled locally (no REPL_ID); use test login

## Environment Variables

Required: `DATABASE_URL` (+ `SESSION_SECRET` in production)
Optional: `AI_INTEGRATIONS_OPENAI_API_KEY`, `VITE_GOOGLE_PLACES_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` (verified Resend sender — without it emails only reach the Resend account owner), `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PLUS`/`STRIPE_PRICE_PREMIUM`, `R2_ENDPOINT`/`R2_BUCKET`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `APP_URL`, `SENTRY_DSN`

Server boot logs a `[on ]/[OFF]` config report per integration (`server/lib/env-validation.ts`) — read the deploy logs to audit what's live.

## Design System

- "Modern Utility" aesthetic, construction orange (#f97316)
- Plus Jakarta Sans (headings), Inter (UI)
- Minimalist, no cards, pill-style components
- Anxiety-aware UX, calm professional tone
