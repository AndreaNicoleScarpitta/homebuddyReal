ALTER TABLE "funds" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "funds" ADD COLUMN "scoped_system_id" integer;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD COLUMN "is_recurring" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD COLUMN "recurrence_cadence" varchar(50);--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD COLUMN "parent_task_id" integer;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD COLUMN "assigned_contractor_id" integer;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD COLUMN "fund_id" integer;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "entity_type" varchar(20) DEFAULT 'asset';--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "contract_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "cadence" varchar(50);--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "contractor_id" integer;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "related_asset_id" integer;--> statement-breakpoint
CREATE INDEX "funds_scoped_system_idx" ON "funds" USING btree ("scoped_system_id");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_contractor_idx" ON "maintenance_tasks" USING btree ("assigned_contractor_id");--> statement-breakpoint
CREATE INDEX "systems_entity_type_idx" ON "systems" USING btree ("entity_type");