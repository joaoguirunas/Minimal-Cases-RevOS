-- ============================================================
-- Prospect PRO™ — Drop v1 tables
--
-- Precondition: migration 20260422000500 already ran
--   (prospect_people renamed to prospect_people_legacy,
--    prospect_people_v2 renamed to prospect_people)
--
-- Tables dropped:
--   - prospect_people_legacy (ex-prospect_people v1, FK child of prospect_establishments)
--   - prospect_establishments (ex-v1 Google Maps staging)
--
-- FK dependency to handle before DROP:
--   prospect_audit_log.establishment_id → prospect_establishments(id) ON DELETE SET NULL
--   Added in migration 20260315195000. Must be dropped explicitly — DROP TABLE CASCADE
--   does not cascade ON DELETE SET NULL; Postgres will block if the FK constraint exists.
--   The column is retained (audit log is immutable), only the FK constraint is removed.
-- ============================================================

BEGIN;

-- 1. Unschedule pg_cron job that targets prospect_establishments (now being dropped).
--    Without this, the job becomes orphaned and will error on every run.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prospect-lgpd-auto-delete')
  THEN
    PERFORM cron.unschedule('prospect-lgpd-auto-delete');
  END IF;
END $$;

-- 2. Drop FK constraint on prospect_audit_log that references prospect_establishments
--    The column establishment_id is kept — only the referential constraint is removed.
ALTER TABLE public.prospect_audit_log
  DROP CONSTRAINT IF EXISTS prospect_audit_log_establishment_id_fkey;

-- 3. Drop legacy v1 people table (FK child of prospect_establishments via establishment_id)
DROP TABLE IF EXISTS public.prospect_people_legacy CASCADE;

-- 4. Drop legacy v1 establishments table
DROP TABLE IF EXISTS public.prospect_establishments CASCADE;

COMMIT;
