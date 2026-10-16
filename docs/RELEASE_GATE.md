# Production release gate

HomeBuddy production on Railway automatically deploys from `main`.

## Required repository rule — configure once

GitHub repository administrator: open **Settings → Rules → Rulesets → New branch ruleset**
(or Settings → Branches → Add branch protection rule), targeting branch `main`.

1. Require a pull request before merging. Require that branches are up to date.
2. Require status checks to pass before merging: select exactly **`release-gate`** from workflow **CI**.
3. Restrict bypass permissions, block force pushes and branch deletion.
4. Activate the ruleset and verify an intentionally failing pull request cannot be merged.

The `release-gate` job in `.github/workflows/ci.yml` fails whenever
`lint-and-typecheck`, `test`, `e2e`, or `build` fails, is cancelled,
or is skipped. The gate uses an `if: always()` dependency check.

**Important:** Merely declaring a GitHub Actions job DOES NOT block merges.
Only the repository ruleset/branch protection makes the check mandatory. The
GitHub integration used to implement this change does not have permission to
configure branch protections.

## Release verification

- Never deploy a feature PR until the `release-gate` check is green.
- Confirm Railway deployed the exact merge commit (not an older build).
- Confirm Railway application and Postgres are online and migrations pass.
- Check `/api/health`, authentication routes and the updated UI on a phone.
- Never execute destructive tests against customer accounts or customer data.

## Test boundaries

CI has its own PostgreSQL database and synthetic accounts. Tests must not point
at the production Railway URL. Test keys and test bypasses are disabled in
production. Password recovery email and object-storage delivery are separate
production integration tasks and not simulated as configured.
