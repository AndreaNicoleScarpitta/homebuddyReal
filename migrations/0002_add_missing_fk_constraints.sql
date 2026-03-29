-- Add missing foreign key constraints to prevent orphaned data
-- These columns exist but lacked FK enforcement

-- systems.contractor_id → contractors.id (SET NULL on delete so system survives)
ALTER TABLE systems
  ADD CONSTRAINT fk_systems_contractor
  FOREIGN KEY (contractor_id) REFERENCES contractors(id)
  ON DELETE SET NULL;

-- systems.related_asset_id → systems.id (SET NULL on delete)
ALTER TABLE systems
  ADD CONSTRAINT fk_systems_related_asset
  FOREIGN KEY (related_asset_id) REFERENCES systems(id)
  ON DELETE SET NULL;

-- maintenance_tasks.parent_task_id → maintenance_tasks.id (SET NULL on delete)
ALTER TABLE maintenance_tasks
  ADD CONSTRAINT fk_tasks_parent_task
  FOREIGN KEY (parent_task_id) REFERENCES maintenance_tasks(id)
  ON DELETE SET NULL;

-- maintenance_tasks.assigned_contractor_id → contractors.id (SET NULL on delete)
ALTER TABLE maintenance_tasks
  ADD CONSTRAINT fk_tasks_assigned_contractor
  FOREIGN KEY (assigned_contractor_id) REFERENCES contractors(id)
  ON DELETE SET NULL;

-- funds.scoped_system_id → systems.id (SET NULL on delete)
ALTER TABLE funds
  ADD CONSTRAINT fk_funds_scoped_system
  FOREIGN KEY (scoped_system_id) REFERENCES systems(id)
  ON DELETE SET NULL;
