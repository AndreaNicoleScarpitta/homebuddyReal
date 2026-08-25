-- Custom migration: Event Log Immutability Trigger
-- Prevents UPDATE and DELETE on the event_log table, ensuring events are
-- truly append-only. This is a critical correctness primitive for the
-- state-machine + immutable event log architecture. Not expressible in
-- shared/schema.ts, so this file is its source of truth. Idempotent.

CREATE OR REPLACE FUNCTION event_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'event_log is immutable: % operations are not allowed', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_event_log_immutable ON event_log;
--> statement-breakpoint

CREATE TRIGGER trg_event_log_immutable
  BEFORE UPDATE OR DELETE ON event_log
  FOR EACH ROW
  EXECUTE FUNCTION event_log_immutable();
