-- Fuzzy duplicate detection
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS inst_name_trgm ON institutions USING gin (legal_name gin_trgm_ops);
--> statement-breakpoint
-- Audit log is append-only: nobody (including the app's DB user) can edit or delete rows.
CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_immutable();
--> statement-breakpoint
-- Closed (won) deal financials are locked. Only a transaction that sets
-- app.allow_locked_edit = 'on' (done by the app solely for Super Admin) may change them.
CREATE OR REPLACE FUNCTION deals_lock_financials() RETURNS trigger AS $$
BEGIN
  IF OLD.financials_locked AND coalesce(current_setting('app.allow_locked_edit', true), 'off') <> 'on' THEN
    IF NEW.mrr IS DISTINCT FROM OLD.mrr
       OR NEW.implementation_fee IS DISTINCT FROM OLD.implementation_fee
       OR NEW.won_at IS DISTINCT FROM OLD.won_at
       OR NEW.financials_locked IS DISTINCT FROM OLD.financials_locked
       OR NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
      RAISE EXCEPTION 'closed deal financials are locked';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS deals_lock ON deals;
--> statement-breakpoint
CREATE TRIGGER deals_lock BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION deals_lock_financials();
--> statement-breakpoint
-- Closed deals cannot be deleted
CREATE OR REPLACE FUNCTION deals_no_delete_closed() RETURNS trigger AS $$
BEGIN
  IF OLD.financials_locked THEN RAISE EXCEPTION 'closed deals cannot be deleted'; END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS deals_no_delete ON deals;
--> statement-breakpoint
CREATE TRIGGER deals_no_delete BEFORE DELETE ON deals FOR EACH ROW EXECUTE FUNCTION deals_no_delete_closed();
