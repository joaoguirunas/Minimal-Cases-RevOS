-- ============================================================
-- Prospect Audit Log: expand action CHECK for V2 pipeline
-- PP3-02: V2 edge functions use actions not in original constraint
-- ============================================================

BEGIN;

-- Drop existing CHECK constraint on action column
ALTER TABLE public.prospect_audit_log
  DROP CONSTRAINT IF EXISTS prospect_audit_log_action_check;

-- Re-create with V1 + V2 actions
ALTER TABLE public.prospect_audit_log
  ADD CONSTRAINT prospect_audit_log_action_check
  CHECK (action IN (
    -- V1 actions (existing)
    'scraped', 'filtered_out', 'enriched', 'scored',
    'approved', 'rejected', 'committed',
    'deleted_lgpd', 'opt_out_registered',
    -- V2 actions (new)
    'searched', 'people_discovered', 'contacts_enriched', 'plugin_executed'
  ));

COMMIT;
