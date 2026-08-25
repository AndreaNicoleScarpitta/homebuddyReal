-- Custom migration: CHECK constraints on status/enum columns.
-- These enforce valid values at the database level, not just the application
-- level. Not modeled in shared/schema.ts, so this file is their source of
-- truth. Idempotent (DROP IF EXISTS + ADD) so it applies cleanly to both
-- fresh databases and existing ones that already have the constraints.

-- maintenance_tasks.status
ALTER TABLE maintenance_tasks
  DROP CONSTRAINT IF EXISTS chk_task_status,
  ADD CONSTRAINT chk_task_status
    CHECK (status IN ('pending', 'scheduled', 'completed', 'skipped')) NOT VALID;
--> statement-breakpoint

-- maintenance_tasks.urgency
ALTER TABLE maintenance_tasks
  DROP CONSTRAINT IF EXISTS chk_task_urgency,
  ADD CONSTRAINT chk_task_urgency
    CHECK (urgency IN ('now', 'soon', 'later', 'monitor')) NOT VALID;
--> statement-breakpoint

-- maintenance_tasks.diy_level
ALTER TABLE maintenance_tasks
  DROP CONSTRAINT IF EXISTS chk_task_diy_level,
  ADD CONSTRAINT chk_task_diy_level
    CHECK (diy_level IN ('DIY-Safe', 'Caution', 'Pro-Only')) NOT VALID;
--> statement-breakpoint

-- maintenance_tasks.created_from
ALTER TABLE maintenance_tasks
  DROP CONSTRAINT IF EXISTS chk_task_created_from,
  ADD CONSTRAINT chk_task_created_from
    CHECK (created_from IN ('manual', 'chat', 'inspection', 'import', 'best-practice')) NOT VALID;
--> statement-breakpoint

-- systems.entity_type
ALTER TABLE systems
  DROP CONSTRAINT IF EXISTS chk_system_entity_type,
  ADD CONSTRAINT chk_system_entity_type
    CHECK (entity_type IN ('asset', 'service')) NOT VALID;
--> statement-breakpoint

-- systems.condition
ALTER TABLE systems
  DROP CONSTRAINT IF EXISTS chk_system_condition,
  ADD CONSTRAINT chk_system_condition
    CHECK (condition IN ('Great', 'Good', 'Fair', 'Poor', 'Unknown')) NOT VALID;
--> statement-breakpoint

-- systems.cadence (service cadence)
ALTER TABLE systems
  DROP CONSTRAINT IF EXISTS chk_system_cadence,
  ADD CONSTRAINT chk_system_cadence
    CHECK (cadence IS NULL OR cadence IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'biannual', 'annual', 'one-time', 'as-needed')) NOT VALID;
--> statement-breakpoint

-- fund_allocations.status
ALTER TABLE fund_allocations
  DROP CONSTRAINT IF EXISTS chk_allocation_status,
  ADD CONSTRAINT chk_allocation_status
    CHECK (status IN ('planned', 'committed', 'paid')) NOT VALID;
--> statement-breakpoint

-- expenses.payment_status
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS chk_expense_payment_status,
  ADD CONSTRAINT chk_expense_payment_status
    CHECK (payment_status IN ('estimated', 'partial', 'paid')) NOT VALID;
--> statement-breakpoint

-- funds.fund_type
ALTER TABLE funds
  DROP CONSTRAINT IF EXISTS chk_fund_type,
  ADD CONSTRAINT chk_fund_type
    CHECK (fund_type IN ('general', 'emergency', 'dedicated')) NOT VALID;
--> statement-breakpoint

-- homes.data_source
ALTER TABLE homes
  DROP CONSTRAINT IF EXISTS chk_home_data_source,
  ADD CONSTRAINT chk_home_data_source
    CHECK (data_source IS NULL OR data_source IN ('manual', 'zillow')) NOT VALID;
