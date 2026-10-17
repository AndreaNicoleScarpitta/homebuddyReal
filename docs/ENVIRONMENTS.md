# HomeBuddy staging and production environments

Updated 2026-10-17. **Implementation status must be verified in Railway and GitHub; this document does not imply console-only controls are enabled.**

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

Production PostgreSQL has a persistent Railway volume. A volume alone **is not a backup**. In Railway → project `attractive-truth` → Postgres → Backups:
- Enable daily scheduled volume snapshots; choose retention based on actual plan limits, e.g. 7 daily and 4 weekly restore points if supported.
- Consider point-in-time recovery for customer data if supported by the selected Postgres service.
- Alert on backup failures and storage exhaustion. Confirm that snapshots are billed.
- For a restoration drill, create a temporary **isolated** database and restore a recent snapshot into it. Validate migration journal, tables, row counts and read queries. Never restore to the production database or reattach its volume.
- Record RPO, RTO, snapshot timestamp, measured restore time, operator and result. Do not mark the drill passed without evidence.
- Configure an appropriate R2 object retention/versioning policy and periodically test readback of a recoverable object without using user PII.

**Schema rollback warning:** Revert the application image only if its code remains compatible with the migrated database schema. Database migrations are not automatically reversible. For incompatible changes, roll forward using an additive migration or restore an isolated snapshot after an approved disaster-recovery decision.

### Monitoring and secrets

Production `/api/health` checks DB connectivity. `/api/version` identifies the commit and environment, not user data. Check 5xx rate, startup failures, PostgreSQL warnings, error monitoring and object-store availability. The app uses Sentry only when `SENTRY_DSN` is configured; `SENTRY_ENVIRONMENT` separates staging from production.

Never log or copy session secrets, auth tokens, provider keys, database passwords, homeowner PII, or documents into CI artifacts. Never use production accounts for QA.

### Remaining manual provider-console actions

1. GitHub Settings → Rules → Rulesets: protect `main` and `staging`, require PR and `release-gate` (unless a rule is already active). Test that a deliberately failing PR cannot merge.
2. Railway production homebuddyReal → Settings → Source → enable **Wait for CI**. Check the live service configuration reflects this.
3. Configure and test backups, volume alerts, R2 recoverability, and Sentry alerts. Connected Railway actions cannot currently set backup schedules.
4. Add a distinct Cloudflare R2 staging bucket if Cloudflare parity is required; replace Railway staging bucket references only after verifying correct credentials and CORS. Do not copy the production bucket keys.
5. Verify staging object-store credentials, upload persistence, OAuth paths, and full Playwright journeys before promoting.
