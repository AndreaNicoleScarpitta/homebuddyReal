-- Add nullable home and system fields that were added to Drizzle schema
-- but never shipped to databases created before the July 2026 baseline.
-- Fully additive/idempotent: no drops, rewrites, or default backfills.
ALTER TABLE "homes" ADD COLUMN IF NOT EXISTS "water_shutoff_location" text;
--> statement-breakpoint
ALTER TABLE "homes" ADD COLUMN IF NOT EXISTS "gas_shutoff_location" text;
--> statement-breakpoint
ALTER TABLE "homes" ADD COLUMN IF NOT EXISTS "electrical_panel_location" text;
--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN IF NOT EXISTS "serial_number" varchar(100);
--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN IF NOT EXISTS "purchase_date" timestamp;
--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN IF NOT EXISTS "manual_url" text;
--> statement-breakpoint
-- Backfill ownership of existing R2 objects from their referenced home.
-- Only unambiguous /objects/<uuid> keys are assigned an owner.
-- If more than one user references a key, refuse to guess; access stays denied.
-- Existing ACLs are preserved.
WITH object_references AS (
  SELECT 'uploads/' || substring(d.object_path from 10) AS object_key,
         h.user_id AS owner_id
  FROM home_documents d
  JOIN homes h ON h.id = d.home_id
  WHERE d.object_path ~ '^/objects/[0-9a-fA-F-]{36}$'
  UNION ALL
  SELECT 'uploads/' || substring(r.object_path from 10) AS object_key,
         h.user_id AS owner_id
  FROM inspection_reports r
  JOIN homes h ON h.id = r.home_id
  WHERE r.object_path ~ '^/objects/[0-9a-fA-F-]{36}$'
)
INSERT INTO object_acl (object_key, owner_id, visibility)
SELECT object_key, MIN(owner_id), 'private'
FROM object_references
GROUP BY object_key
HAVING COUNT(DISTINCT owner_id) = 1
ON CONFLICT (object_key) DO NOTHING;
