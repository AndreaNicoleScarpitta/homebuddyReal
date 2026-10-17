# HomeBuddy — reliability, backups and recovery

Updated 2026-10-17. **These are operational instructions, not evidence that a production backup or restore test has already succeeded.**

## Branch protections

Production `main` is protected through the active **Homebuddy Protected Branches** GitHub ruleset requiring `release-gate`. Protect `staging` as well: GitHub → repository Settings → Rules → Rulesets; add an exact target pattern `staging` to an appropriate ruleset (or create a second named `HomeBuddy Staging`). Require PRs and the `release-gate` CI check. Block force pushes, deletion and unrestricted bypass; allow zero approvers while the founder works solo. **Do not select "all branches",** which would restrict feature branch development.

After saving, verify both `main` and `staging` return `protected: true` from GitHub and a deliberately failed required check blocks merging.

Staging deployment is exercised by post-deploy `Staging smoke verification`, so leave Railway's staging Wait for CI **Off** until the smoke job is rearranged; otherwise Railway would wait for a job that waits for Railway deployment, causing a deadlock. Production Wait for CI must remain On.

## Scheduled production PostgreSQL backups

Project: Railway `attractive-truth` → `Postgres` → **Backups**.

1. Enable **Daily**, **Weekly**, and **Monthly** scheduled volume backups if budget allows. Railway's documented retention: daily 6 days, weekly 27 days, monthly 89 days. Multiple schedules may be enabled together.
2. Trigger one **manual backup** and wait until its timestamp and successful state appear in the Backups tab. Note its timestamp, service/volume IDs, and charged incremental bytes.
3. Record who receives backup/health alerts and verify the alerting channel. Set and document RPO/RTO. A volume by itself is not a backup.
4. Verify permissions limit who can delete production volumes. **Wiping a volume deletes its backups.** Consider encrypted backups stored outside Railway for disaster recovery.

Railway backup schedules **cannot be read or configured through the connected integration used for this work**. Do not mark backups configured until their presence is confirmed in the Railway dashboard. Backups are incremental, billable storage.

### Restoration drill — do not restore onto the live database

Railway's native volume-backup restore is scoped to the *same project and environment* and changes the mounted volume of its database service. **Do not click Restore/Deploy on production Postgres to perform a drill:** it would replace the live database. The separate staging Railway project cannot directly receive this native backup.

Perform a non-destructive drill using an encrypted logical backup (`pg_dump -Fc`) of production, a disposable isolated PostgreSQL instance with new credentials, and `pg_restore` to that instance. Run it through a secure operator machine/CI with least-privilege database access. Never upload credentials, data dumps or customer information into this repository, CI artifacts or logs. Validate schema, migration journal and representative table row counts, document recovery time, then securely delete the disposable copy. For an entirely synthetic drill, you may use a staging PostgreSQL logical backup to prove the command path, but **do not count this as proof that production data is recoverable**.

If you need a true same-environment snapshot restoration, use a maintenance window and a separately reviewed disaster-recovery plan. Avoid unintentionally disrupting live traffic.

## PostgreSQL warnings

Railway reported **two service warnings** while production PostgreSQL was online. The Oct 15 logs show obsolete SQL queries referencing `inspection_reports.user_id` and `job_queue.data`; the code now uses ownership JOINs and `job_queue.payload`. Logs queried for Oct 17 showed no PostgreSQL ERROR/WARNING entries, and CPU, memory and disk usage were low. This is evidence of improvement, **not proof that the two Railway warning notifications are resolved**. Open Postgres → Observability/Issues and inspect the two warning descriptions and timestamps. Resolve the underlying reason before dismissing a notification. Record the final status.

## Stripe, donations and legacy subscriber access

HomeBuddy only offers one-time donations to new users. The direct `POST /api/donations/checkout` endpoint calls Stripe Checkout with `STRIPE_SECRET_KEY`. Its historical subscription service, managed webhook registration and backfill are now opt-in (`STRIPE_SYNC_ENABLED=1`), disabled by default, because they are unnecessary for voluntary donation checkout.

**Production currently logs a StripeAuthenticationError (invalid `sk_live_...` API key).** Turning off legacy synchronization removes noisy boot calls, **but does not fix live donations**. In the Stripe dashboard, obtain a valid live-mode secret key with the minimum permissions needed for Checkout and any retained customer portal access; configure it only in Railway Variables → `STRIPE_SECRET_KEY`. Do not paste the value into tickets, GitHub, logs or chat. Verify any historical subscriber cancellation paths before rotating or disabling their integration. If the key was compromised, rotate it in Stripe and retire the previous key according to Stripe's guidance.

After setting a valid key, test a **safe provider operation** (for example read-only authenticated account lookup) using a secure operator environment; then verify that a small donation checkout opens successfully and cancels without charging the account. Only then mark donations PASS. Ensure the `STRIPE_WEBHOOK_SECRET` is valid for any active Stripe webhook events. Do not re-enable legacy sync merely to make donations work.

## Release and alert checks

Before every production promotion: CI `release-gate` PASS, live staging smoke PASS, exact staging commit matches promotion PR, Railway Wait for CI enabled, production health check PASS, Postgres availability, no newly introduced 5xx errors, and backup state confirmed. If an incompatible migration is applied, code rollback alone cannot restore the previous schema.
