-- Nullable link; preserve all previously uploaded home-level documents.
-- Only legacy system identifiers are stored here, never event-store UUIDs.
ALTER TABLE "home_documents" ADD COLUMN IF NOT EXISTS "system_id" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "home_documents_system_id_idx" ON "home_documents" ("system_id");
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'home_documents_system_id_fkey') THEN
    ALTER TABLE "home_documents"
      ADD CONSTRAINT "home_documents_system_id_fkey"
      FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id")
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;
