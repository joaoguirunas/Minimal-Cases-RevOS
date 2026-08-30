-- ============================================================
-- Prospect PRO: expand status CHECK constraint
-- Adds 'committed' and 'partial_error' to allowed values
-- Required by prospect-commit edge function
-- ============================================================

BEGIN;

-- Drop the existing inline CHECK constraint and re-create with expanded values
ALTER TABLE public.prospect_establishments
  DROP CONSTRAINT IF EXISTS prospect_establishments_status_check;

ALTER TABLE public.prospect_establishments
  ADD CONSTRAINT prospect_establishments_status_check
  CHECK (status IN ('raw', 'enriched', 'scored', 'pending_review', 'approved', 'rejected', 'committed', 'partial_error'));

COMMIT;
