# HomeBuddy — reliability, backups and recovery

Updated 2026-10-17 after verified production deployment, a PITR recovery drill and successful donation checkout. Future changes must be verified independently.

## Branch protections

Production `main` is protected through the active **Homebuddy Protected Branches** GitHub ruleset requiring `release-gate`. `staging` is also protected by an enforced GitHub ruleset requiring a PR and `release-gate`. Do not bypass either branch. **Do not select "all branches",** which would restrict feature branch development.

After saving, verify both `main` and `staging` return `protected: true` from GitHub and a deliberately failed required check blocks merging.

Staging deployment is exercised by post-deploy `Staging smoke verification`, so leave Railway's staging Wait for CI **Off** until the smoke job is rearranged; otherwise Railway would wait for a job that waits for Railway deployment, causing a deadlock. Production Wait for CI must remain On.

## Scheduled production PostgreSQL backups

Project: Railway `attractive-truth` → `Postgres` → **Backups**.

1. Enable **Daily**, **Weekly**, and **Monthly** scheduled volume backups if budget allows. Railway's documented retention: daily 6 days, weekly 27 days, monthly 89 days. Multiple schedules may be enabled together.
2. Trigger one **manual backup** and wait until its timestamp and successful state appear in the Backups tab. Note its timestamp, service/volume IDs, and charged incremental bytes.
3. Record who receives backup/health alerts and verify the alerting channel. Set and document RPO/RTO. A volume by itself is not a backup.
4. Verify permissions limit who can delete production volumes. **Wiping a volume deletes its backups.** Consider encrypted backups stored outside Railway for disaster recovery.

Railway backup schedules **cannot be read or configured through the connected integration used for this work**. Do not mark backups configured until their presence is confirmed in the Railway dashboard. Backups are incremental, billable storage.

### Point-in-time recovery and drills

Production PostgreSQL has PITR enabled with a live `Postgres-PITR` WAL archive. On October 17, 2026, a separate `Postgres-restored-...` service was created from the PITR timeline, recovered to a consistent state and accepted connections. The user accessed the restored database. The service and its test volumes were deleted after verification, without changing the production database volume.

**Use the upper “Point-in-time recovery” → “Restore to this moment” control for a non-destructive drill:** it creates a sibling PostgreSQL service. A normal **volume-backup Restore** instead stages a swap of the **existing production PostgreSQL mount**. Never apply it as a recovery test. Review the Railway pending changes before deploying anything.

Preserve the original `Postgres`, `postgres-volume`, and `Postgres-PITR` resources. A PITR restored sibling is a real production-data copy: restrict access and delete it when finished. The completed drill verified infrastructure-level restore only; future drills should validate the recovered tables/row counts, record elapsed restore time, and test offsite recovery separately.

## PostgreSQL warnings and usage advisories

Railway displayed two warning notifications. Review showed the public database URL/network egress advisory and a Railway **usage alert**; neither was evidence of a PostgreSQL outage. The application uses the private Railway connection. Historical SQL column errors were corrected by previous deployments; no matching new PostgreSQL SQL errors were observed after the fixes. Continue to review disk/CPU, WAL push success, costs and new error logs; do not assume every future alert is benign.

## Stripe, donations and legacy subscriber access

HomeBuddy only offers one-time donations to new users. The direct `POST /api/donations/checkout` endpoint calls Stripe Checkout with `STRIPE_SECRET_KEY`. Its historical subscription service, managed webhook registration and backfill are now opt-in (`STRIPE_SYNC_ENABLED=1`), disabled by default, because they are unnecessary for voluntary donation checkout.

The historical live Stripe key failed authentication, but was replaced in Railway on 2026-10-17. The application was redeployed, and a real `POST /api/donations/checkout` returned **HTTP 200**, opening hosted Stripe Checkout without completing payment. Keep the live secret only in Railway; do not include it in issues, GitHub or chat. Existing subscription webhook routes remain and require separate signing-secret/customer-portal verification.

**Status:** donation Checkout session creation verified PASS; actual payment settlement, webhook delivery, customer portal and legacy subscriber lifecycle are **not** covered by this test. Reverify these separately before changing webhook/legacy billing behavior. Never re-enable legacy sync merely to make donations work.

## Release and alert checks

Before every production promotion: CI `release-gate` PASS, live staging smoke PASS, exact staging commit matches promotion PR, Railway Wait for CI enabled, production health check PASS, Postgres availability, no newly introduced 5xx errors, and backup state confirmed. If an incompatible migration is applied, code rollback alone cannot restore the previous schema.
