# Contributing to HomeBuddy

## First-hour checklist

1. Read `README.md` and `docs/ARCHITECTURE.md`.
2. Follow `docs/LOCAL_DEVELOPMENT.md` with a **local** PostgreSQL 16 container and synthetic data.
3. Run `npm run db:migrate`, `npm run dev`, and confirm http://localhost:5000/api/health.
4. Create a disposable local user and complete Quick setup. Verify starter maintenance tasks appear in Plan.
5. Run `npm run check`, `npm test`, `npm run test:e2e` and `npm run build` (install Playwright Chromium first).

**Suggested first PR:** improve a small, accessible piece of Home/Plan/My House UI or add regression coverage for task filtering. Avoid altering schema, payments, authentication, or document permissions in an initial PR.

## Branching and review

Branch **from `staging`**, not `main`:

```sh
git fetch origin
git switch staging
git pull --ff-only
git switch -c feat/short-description
```

Commit focused changes, push the feature branch, and open a PR targeting `staging`. Describe affected homeowner journeys and attach screenshots for mobile UX changes. Request a review before merging where a reviewer is available. Both `staging` and `main` are protected; **do not force-push, bypass, or push directly**.

CI's `release-gate` requires typecheck, DB-backed tests, Playwright, and build. A passing PR check is not enough to justify bypassing live staging testing. Once a change is merged to `staging`, Railway deploys that SHA and the staging smoke workflow runs on synthetic accounts, including onboarding, document persistence, and account deletion.

A **production promotion** is a separate PR from exact `staging` HEAD to `main`. The promotion check confirms the proposed SHA is actually serving in staging. Railway production waits for CI after merge and then deploys; confirm the running SHA, health check, migration status, and relevant user journey. Production merges require explicit release authorization; do not assume feature PR approval is production deployment approval.

## Data and migration safety

- **Never** store credentials, customer data, copies of production documents, or database exports in commits, PRs, or CI artifacts.
- Use synthetic user/home details and disposable test accounts. Real documents belong only in authorized production storage.
- For a schema change: edit Drizzle schema; generate a migration (`npx drizzle-kit generate --name change-name`); **review** SQL carefully; test it against a disposable local DB; commit the migration.
- `npm run db:push` is **never allowed in CI, staging, or production**. It can remove manually written SQL constraints/triggers.
- Do not rename/drop production columns in the same release as removal of application readers; plan backwards compatibility and backups.
- Verify authorization at the home/document ownership boundary on every new endpoint.
- Keep optional integrations sandboxed, especially Stripe (test mode), R2 (dev bucket), email and AI.

## Pull request quality bar

Complete the PR template. Include a clear change summary, links to an issue if relevant, screenshots (mobile if UI), affected endpoints/schemas, manual test notes, and deployment/rollback considerations. Add tests for fixed bugs and changed domain rules. Describe side effects, outbound provider calls, and migration or secret changes explicitly.

Useful runbooks: `docs/ENVIRONMENTS.md`, `docs/RELEASE_GATE.md`, `docs/OPERATIONS_RECOVERY.md`. For architecture debt, see `docs/simplification-remaining-work.md`.
