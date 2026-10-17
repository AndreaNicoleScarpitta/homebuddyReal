# HomeBuddy engineering architecture

This is the current system map for engineers. Treat the source and runtime behavior as authoritative when documentation differs.

## Product and navigation

HomeBuddy is an intelligent **operating record of a home**: record its systems and documents, surface maintenance work, and make actions traceable.

- **Home / Overview:** the homeowner's snapshot. The Needs Attention card takes the user to maintenance planning.
- **Plan:** maintenance tasks grouped by clickable **Upcoming**, **Due / Urgent**, **Past Due**, and **Completed** summary cards. Clicking a card filters the task list; there are no redundant parallel filter tabs.
- **My House:** home systems and reference information (including shutoffs, electrical/circuit information, and service details), with saved documents under **House files**. System detail pages retain deep links.
- **Quick setup:** creates a home and its systems, then starter maintenance tasks. Keep the task creation journey verified end-to-end.
- **Documents:** home-scoped files, with permissioned upload/download and optional analysis suggesting systems/tasks; suggestions should use an explicit approval flow.
- **Support:** voluntary one-time donations only. Legacy subscription upgrade checkout returns HTTP 410.

Routes live primarily in `client/src/App.tsx` and `client/src/pages/`. UI is React 19, Vite, Tailwind, Wouter, and a mobile-first PWA.

## Request and data flow

```text
Browser / PWA
    ↕ HTTP + session cookie / CSRF
Express (server/index.ts)
    ├─ authentication + session storage (server/replit_integrations/auth)
    ├─ legacy /api routes (server/routes.ts and feature-specific route files)
    ├─ /v2 domain routes (server/routes_v2.ts)
    ├─ service / event / projection logic (server/domain, eventing, projections)
    ├─ Drizzle ORM / SQL (server/db.ts, shared/schema.ts)
    └─ external integrations (R2, AI, Resend, Stripe)
                     ↕
               PostgreSQL
```

Do not infer that all endpoints use event sourcing. **Both legacy `/api` and `/v2` remain active.** Prefer the existing canonical route for a resource, and trace its frontend callers and authorization path before creating another endpoint. For event-sourced changes, inspect `server/eventing/`, `server/domain/`, `server/projections/`, and tests before touching write paths. Avoid broad route rewrites in a feature PR.

## Authentication, privacy and data isolation

Email/password signup and login are implemented in `server/replit_integrations/auth/localAuth.ts`; Google OAuth is optional. Sessions persist in PostgreSQL. CSRF middleware, auth guards, home ownership checks, and per-home authorization are mandatory on reads and writes. Do not rely on a client-provided home/user ID as authorization.

Never bypass document ownership checks or expose R2 credentials/public object access to debug upload behavior. Keep uploaded documents private and avoid logging homeowner PII, secrets, or document contents.

## Storage, analysis and task scheduling

- Database schemas are defined by `shared/schema.ts` and migrations in `migrations/`. `script/migrate.ts` applies reviewed migrations and validates schema drift at boot.
- Uploaded documents are stored in object storage; production uses Cloudflare R2 and staging uses a separate Railway S3-compatible bucket. A row in the database does not by itself prove an object upload succeeded.
- Document analysis integrates with AI and produces suggestions. Inspect the document-analysis and approval pipeline before modifying task creation or authorization.
- Starter and recurring maintenance tasks involve domain logic, backend writes and frontend projections; keep task bucketing and lifecycle tests intact.
- Asynchronous work is in `server/jobs/` and `server/worker/`. The application startup and the notification scheduler are in `server/index.ts`.

## Operations and change boundaries

- **Environments:** isolated Railway projects for staging and production; never reuse production provider keys or datasets in local/staging.
- **Billing:** `server/billing-routes.ts` supports one-time donations; historical Stripe sync is disabled by default (`STRIPE_SYNC_ENABLED=1` is a deliberate opt-in). Don't remove legacy subscriber handling without an audited migration.
- **Releases:** feature PR → `staging` → live smoke → exact staging SHA promotion PR → `main` → Railway Wait for CI.
- **Database evolution:** additive SQL migrations first, remove old columns only after an explicit compatibility and backup review. `db:push` is local-only and potentially destructive.
- **Recovery:** production PostgreSQL uses scheduled backups plus PITR; a volume-backup restore can replace the live mount. Follow `docs/OPERATIONS_RECOVERY.md` instead of experimenting on production.

## Where to start investigating a bug

| Symptom | Primary paths |
| --- | --- |
| Home, Plan, My House mobile UX | `client/src/App.tsx`, `client/src/pages/dashboard.tsx`, `client/src/pages/house.tsx` |
| Quick setup / missing starter tasks | `client/src/pages/onboarding.tsx`, `server/routes_v2.ts`, domain logic and `e2e/homeowner-journey.spec.ts` |
| Document upload / House files | `server/routes.ts`, `server/routes_v2.ts`, `client/src/pages/house.tsx`, object-store code |
| Authentication / deletion | `server/replit_integrations/auth/`, auth/API tests, `e2e/staging-journey.spec.ts` |
| DB schema mismatch | `shared/schema.ts`, `migrations/`, `script/migrate.ts` |
| Donation checkout | `server/billing-routes.ts`, `server/stripeClient.ts`, `e2e/donation-support.spec.ts` |

See `CONTRIBUTING.md` for testing and delivery requirements.
