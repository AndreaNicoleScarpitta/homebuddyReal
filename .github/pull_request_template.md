## Change

What changed, and which HomeBuddy user problem does it solve?

## Impact and evidence

- Affected flows/routes:
- Mobile screenshots (if UI):
- Existing user data/security implications:

## Verification

- [ ] `npm run check`
- [ ] `npm test`
- [ ] `npm run test:e2e` (or reason not applicable)
- [ ] `npm run build`
- [ ] Manually verified affected flow with synthetic local/staging data

## Operational safety

- [ ] No customer data, credentials, or production database URLs in the PR
- [ ] Home/document ownership and authorization preserved
- [ ] Any migrations reviewed, compatible, and tested against local database
- [ ] Optional integration keys are sandbox-only in local/staging
- [ ] No destructive production cleanup in this PR
- [ ] Rollout/rollback and any manual provider steps documented

**Target `staging` for feature work.** Production releases are separate, explicit `staging` → `main` promotion PRs with exact staging SHA verification.
