-- Custom migration: foreign key constraints on columns that exist in
-- shared/schema.ts without .references(), so drizzle-kit never generates
-- them. This file is their source of truth. Idempotent (DROP IF EXISTS +
-- ADD) so it applies cleanly to databases that already have them.

-- systems.contractor_id → contractors.id (SET NULL on delete so system survives)
ALTER TABLE systems
  DROP CONSTRAINT IF EXISTS fk_systems_contractor,
  ADD CONSTRAINT fk_systems_contractor
  FOREIGN KEY (contractor_id) REFERENCES contractors(id)
  ON DELETE SET NULL NOT VALID;
--> statement-breakpoint

-- systems.related_asset_id → systems.id (SET NULL on delete)
ALTER TABLE systems
  DROP CONSTRAINT IF EXISTS fk_systems_related_asset,
  ADD CONSTRAINT fk_systems_related_asset
  FOREIGN KEY (related_asset_id) REFERENCES systems(id)
  ON DELETE SET NULL NOT VALID;
--> statement-breakpoint

-- maintenance_tasks.parent_task_id → maintenance_tasks.id (SET NULL on delete)
ALTER TABLE maintenance_tasks
  DROP CONSTRAINT IF EXISTS fk_tasks_parent_task,
  ADD CONSTRAINT fk_tasks_parent_task
  FOREIGN KEY (parent_task_id) REFERENCES maintenance_tasks(id)
  ON DELETE SET NULL NOT VALID;
--> statement-breakpoint

-- maintenance_tasks.assigned_contractor_id → contractors.id (SET NULL on delete)
ALTER TABLE maintenance_tasks
  DROP CONSTRAINT IF EXISTS fk_tasks_assigned_contractor,
  ADD CONSTRAINT fk_tasks_assigned_contractor
  FOREIGN KEY (assigned_contractor_id) REFERENCES contractors(id)
  ON DELETE SET NULL NOT VALID;
--> statement-breakpoint

-- funds.scoped_system_id → systems.id (SET NULL on delete)
ALTER TABLE funds
  DROP CONSTRAINT IF EXISTS fk_funds_scoped_system,
  ADD CONSTRAINT fk_funds_scoped_system
  FOREIGN KEY (scoped_system_id) REFERENCES systems(id)
  ON DELETE SET NULL NOT VALID;
