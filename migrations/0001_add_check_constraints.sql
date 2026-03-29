-- Migration: Add CHECK constraints on status/enum columns
-- These enforce valid values at the database level, not just the application level.

-- maintenance_tasks.status
ALTER TABLE maintenance_tasks
  DROP CONSTRAINT IF EXISTS chk_task_status,
  ADD CONSTRAINT chk_task_status
    CHECK (status IN ('pending', 'scheduled', 'completed', 'skipped'));

-- maintenance_tasks.urgency
ALTER TABLE maintenance_tasks
  DROP CONSTRAINT IF EXISTS chk_task_urgency,
  ADD CONSTRAINT chk_task_urgency
    CHECK (urgency IN ('now', 'soon', 'later', 'monitor'));

-- maintenance_tasks.diy_level
ALTER TABLE maintenance_tasks
  DROP CONSTRAINT IF EXISTS chk_task_diy_level,
  ADD CONSTRAINT chk_task_diy_level
    CHECK (diy_level IN ('DIY-Safe', 'Caution', 'Pro-Only'));

-- maintenance_tasks.created_from
ALTER TABLE maintenance_tasks
  DROP CONSTRAINT IF EXISTS chk_task_created_from,
  ADD CONSTRAINT chk_task_created_from
    CHECK (created_from IN ('manual', 'chat', 'inspection', 'import', 'best-practice'));

-- systems.entity_type
ALTER TABLE systems
  DROP CONSTRAINT IF EXISTS chk_system_entity_type,
  ADD CONSTRAINT chk_system_entity_type
    CHECK (entity_type IN ('asset', 'service'));

-- systems.condition
ALTER TABLE systems
  DROP CONSTRAINT IF EXISTS chk_system_condition,
  ADD CONSTRAINT chk_system_condition
    CHECK (condition IN ('Great', 'Good', 'Fair', 'Poor', 'Unknown'));

-- systems.cadence (service cadence)
ALTER TABLE systems
  DROP CONSTRAINT IF EXISTS chk_system_cadence,
  ADD CONSTRAINT chk_system_cadence
    CHECK (cadence IS NULL OR cadence IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'biannual', 'annual', 'one-time', 'as-needed'));

-- fund_allocations.status
ALTER TABLE fund_allocations
  DROP CONSTRAINT IF EXISTS chk_allocation_status,
  ADD CONSTRAINT chk_allocation_status
    CHECK (status IN ('planned', 'committed', 'paid'));

-- expenses.payment_status
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS chk_expense_payment_status,
  ADD CONSTRAINT chk_expense_payment_status
    CHECK (payment_status IN ('estimated', 'partial', 'paid'));

-- funds.fund_type
ALTER TABLE funds
  DROP CONSTRAINT IF EXISTS chk_fund_type,
  ADD CONSTRAINT chk_fund_type
    CHECK (fund_type IN ('general', 'emergency', 'dedicated'));

-- homes.data_source
ALTER TABLE homes
  DROP CONSTRAINT IF EXISTS chk_home_data_source,
  ADD CONSTRAINT chk_home_data_source
    CHECK (data_source IS NULL OR data_source IN ('manual', 'zillow'));
