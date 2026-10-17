# HomeBuddy — AI coding agent guidance

**Read [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first.** They are the canonical engineer onboarding and architecture sources. Use [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for an isolated local environment.

## Product

HomeBuddy is the intelligent operating record of a home. Three main surfaces: Home/Overview (Needs Attention leads to Plan), Plan (Upcoming, Due / Urgent, Past Due, Completed clickable task summaries), My House (systems, shutoffs/reference info, documents in House files). Quick setup must create starter tasks; document analysis may suggest systems/tasks with owner approval.

HomeBuddy currently offers **one-time voluntary donations**, not paid subscription upgrades. Do **not** revive deprecated paid plan checkout. Historical Stripe subscriber paths remain; legacy synchronization is off by default (`STRIPE_SYNC_ENABLED=1` only by explicit reviewed opt-in).

## Development rules

- Work on a branch based on `staging`; PR to `staging`. Promotion to `main` is a separate guarded release.
- Node 20, local Postgres 16 on localhost:5433, `npm run dev`, `npm run db:migrate`, `npm run check`, `npm test`, `npm run test:e2e`, `npm run build`.
- Do not rely on a shared test account. Use synthetic local account creation.
- Never access production data, R2 buckets or secret keys for local debugging. Keep test objects private.
- Use reviewed, additive migrations. Never use `db:push` on staging or production.
- Respect auth, CSRF, document/home ownership, event projections, and the distinct `/api` and `/v2` implementations. Do not refactor route stacks as a side effect.
- Keep mobile layouts usable and test first-time signup → setup → task planning → account deletion flows.
- Read `docs/OPERATIONS_RECOVERY.md` before any database, backup, or Stripe operational changes.

## Key entry points

- React routes: `client/src/App.tsx`; pages: `client/src/pages`.
- Express startup: `server/index.ts`; auth: `server/replit_integrations/auth`.
- HTTP routes: `server/routes.ts`, `server/routes_v2.ts`; storage/ownership: `server/storage.ts` and related services.
- Eventing: `server/eventing`, `server/domain`, `server/projections`.
- Drizzle schema: `shared/schema.ts`; migrations: `migrations/`; runner: `script/migrate.ts`.
- Donation route: `server/billing-routes.ts`; document analysis: `server/lib/analysis-pipeline`.

When this file conflicts with source behavior or runtime evidence, investigate and fix the stale instructions rather than assuming older design notes are still in force.
