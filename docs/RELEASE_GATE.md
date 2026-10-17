# HomeBuddy protected release process

Verified in the Railway and GitHub production setup on 2026-10-17. Verify live controls again before an actual release.

## Protected branches and required checks

- `staging` and `main` are protected by enforced GitHub rulesets. Do not push directly, force-push, delete or bypass.
- A feature PR targets **staging**; CI runs `lint-and-typecheck`, `test`, `e2e`, `build`, and the aggregate required `release-gate` check.
- Merging `staging` deploys Railway's **separate staging project**; the staging smoke workflow then creates and deletes synthetic accounts and verifies lifecycle operations.
- A **production** PR must originate from `staging` and pass `staging-promotion`, which verifies the **exact staging SHA** is live and tests the homeowner/document journey before allowing a `main` merge.
- Railway production `homebuddyReal` has **Wait for CI enabled** (`source.checkSuites=true`), verified in the October 17 production promotion. Production waits for the complete main CI workflow before deploying.

**Do not enable Railway Wait for CI on staging under the current workflow**: the staging smoke job waits for the live staging deployment, so enabling it would create a dependency cycle.

## Production release checklist

1. Confirm the staging environment is healthy, serving the exact SHA, and its smoke workflow passed.
2. Verify the promotion PR and aggregate GitHub checks passed, plus any schema migration review.
3. Obtain explicit release authorization and merge the protected promotion PR.
4. Confirm Railway waited for CI and deployed the **merge commit SHA**, not merely the staging SHA.
5. Inspect migration + schema-drift output, database connection, `/api/health`, `/api/version`, startup logs, and no increase in 5xx errors.
6. Verify mobile auth/onboarding, maintenance tasks and any changed document/payment journey. Do not run destructive tests against customer data.
7. Ensure rollback compatibility; **reverting code does not reverse an applied database migration**.

## Local/CI test boundaries

CI PostgreSQL is ephemeral and isolated. The Playwright configuration explicitly refuses arbitrary remote URLs and production test targets. Local runs should use Docker Compose PostgreSQL on localhost:5433 and a synthetic user. Never bypass auth, secret management or home ownership to satisfy CI.

Staging uses its own database/object-storage bucket. Live Stripe keys and production homeowner documents do not belong in staging.

For incident handling, see [OPERATIONS_RECOVERY.md](OPERATIONS_RECOVERY.md).
