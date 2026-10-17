# HomeBuddy staging and production environments

Updated 2026-10-17 following successful release and recovery verification. Runtime/provider state must always be rechecked before operational changes.

## Infrastructure topology

| Target | Railway project | Environment | Git branch | Data |
| --- | --- | --- | --- | --- |
| Staging | `homebuddy-staging` (`9da4e277-8a9a-47e7-8395-03be9b2a7ed0`) | `staging` | `staging` | Separate PostgreSQL volume and separate Railway S3-compatible bucket |
| Production | `attractive-truth` (`e31f7f08-7915-4ee9-8755-8f454fb2d73d`) | `production` | `main` | Existing PostgreSQL and Cloudflare R2 |

The connected Railway integration cannot create an environment in an existing project. A separate staging project was provisioned intentionally to avoid copying production secrets. This diverges from the original request for two environments *within the same project*. Do not infer data isolation solely from the project boundary; audit service variables and functional permissions.

Staging URL: https://homebuddy-web-staging.up.railway.app
Production URL: https://www.homebuddy.space

### Staging service configuration

- `homebuddy-web`: `NODE_ENV=production`, `SENTRY_ENVIRONMENT=staging`, real auth, no test-header bypass.
- `DATABASE_URL`: Railway reference `${{Postgres.DATABASE_URL}}`; do not paste a production connection string.
- `SESSION_SECRET`: independent random value. Never place in the repository.
- `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`: references to the staging project's `homebuddy-staging-documents` bucket. It is Railway S3-compatible storage, **not** a Cloudflare R2 staging bucket. Validate PUT/GET/DELETE and browser presigned-upload CORS before declaring document parity.
- OAuth callback: staging `APP_URL` and `OAUTH_BASE_URL`. Google OAuth intentionally disabled until separate callback credentials are supplied.
- Stripe, Resend email, and paid AI keys: intentionally **not copied** to staging. Live payment/email/AI side effects must never be enabled in staging without safe sandbox credentials and limits.
- `ALLOW_TEST_USER_HEADER=0` (disabled). Staging users log in normally.
- Build: same source build as production, `npm run db:migrate` pre-deploy, `/api/health` health check.

### Release policy

1. Develop and PR into `staging`, with CI release-gate passing before merge.
2. Railway staging deploys the staging branch and applies **staging** migrations to its separate PostgreSQL instance.
3. Inspect staging logs and perform live smoke checks. Use GitHub Actions → **Staging smoke verification** and supply the exact 40-character staging commit SHA. The verifier checks `/api/version`, `/api/health`, and `/login`. The verifier uses only read-only endpoints; the associated Playwright staging journey uses newly created synthetic accounts and deletes them. It does not replace full human QA.
4. Promote by PR from `staging` into `main`. The `staging-promotion` CI check requires the exact proposed source SHA to be live and healthy in staging. PRs from other branches to `main` fail.
5. Protect `main` and `staging` in GitHub. Require the `release-gate` check; reject direct pushes, bypasses and force pushes.
6. Railway production → homebuddyReal → Settings → Source → **Wait for CI: On**. Verify `source.checkSuites=true`. The integration used for initial provisioning does not expose this property for writes.
7. Approve and merge a green promotion PR, then compare production's Railway deployed SHA with the merge commit SHA. Verify `/api/health`, `/api/version`, and authentication/PWA manually.

**Fail closed:** Do not promote if staging health, migrations, browser QA, document storage, or CI is unknown. A green unit-test run alone is not a release authorization.

### Backups and recovery

- Production PostgreSQL uses a persistent volume, scheduled volume snapshots, and a live `Postgres-PITR` bucket.
- On 2026-10-17, a PITR restore into an **isolated new service** completed at the selected transaction timestamp; Postgres reached consistent recovery and accepted connections. The temporary service and detached volumes were subsequently deleted. This confirms infrastructure-level recovery, **not** a row-by-row production data audit.
- A **volume backup restore** would stage a mount replacement on the existing production Postgres. Never deploy such a restore for an ordinary rehearsal.
- Scheduled backups are verified in the Railway dashboard, not exposed by the connected Railway API. Preserve at least one historical recovery point and monitor backup failures/storage costs.
- See [OPERATIONS_RECOVERY.md](./OPERATIONS_RECOVERY.md) for restore boundaries and operator instructions.

### Monitoring and secrets

Production `/api/health` checks DB connectivity. `/api/version` identifies the commit and environment, not user data. Check 5xx rate, startup failures, PostgreSQL warnings, error monitoring and object-store availability. The app uses Sentry only when `SENTRY_DSN` is configured; `SENTRY_ENVIRONMENT` separates staging from production.

Never log or copy session secrets, auth tokens, provider keys, database passwords, homeowner PII, or documents into CI artifacts. Never use production accounts for QA.

### Manual operational follow-ups

1. Verify any new Cloudflare/Railway object-storage integration uses isolated staging credentials and CORS rather than copying production document secrets.
2. Monitor backup and alert delivery, PITR storage costs, and Sentry; test offsite backup recovery separately if required by reliability targets.
3. Maintain and periodically test protected branches, Railway Wait for CI, and the exact-SHA staging promotion gate.

### October 2026 reliability follow-up

See [OPERATIONS_RECOVERY.md](./OPERATIONS_RECOVERY.md) for production backup schedules, restore testing boundaries, staging branch protection, and Stripe key rotation.

The legacy `stripe-replit-sync` startup process is opt-in via `STRIPE_SYNC_ENABLED=1` (default disabled). On October 17 the production Stripe key was replaced and one-time donation checkout returned HTTP 200 and opened Stripe Checkout without charging a card. Webhook/payment completion and historical subscriber access are separate verification boundaries; do not re-enable legacy sync automatically.
