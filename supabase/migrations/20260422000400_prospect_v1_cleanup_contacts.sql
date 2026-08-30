-- ============================================================
-- Prospect PRO™ — v1 Cleanup (Part 1)
-- Drop prospect_contacts (dead table post-split) + view + pg_cron update
--
-- prospect_contacts was split into prospect_establishments + prospect_people
-- in migration 20260315195000. No edge function or frontend hook references it.
-- prospect_contacts_v (the compat view) is also dropped as it projecs from
-- prospect_establishments which remains active for the v1 pipeline.
--
-- prospect_establishments and prospect_people (v1) are NOT dropped here:
-- they are still used by prospect-filter, prospect-scorer and the v1 branch
-- of prospect-commit. Their cleanup is blocked on updating those edge functions.
-- ============================================================

BEGIN;

-- 1. Drop compatibility view
DROP VIEW IF EXISTS public.prospect_contacts_v;

-- 2. Drop prospect_contacts (cascades FK from audit_log.contact_id — which is
--    intentionally without FK constraint, so nothing to cascade there)
DROP TABLE IF EXISTS public.prospect_contacts CASCADE;

-- 3. Update pg_cron LGPD auto-delete: was targeting prospect_contacts, now
--    targets prospect_establishments (the active v1 staging table).
--    Uses cron.schedule which is idempotent — replaces the existing job by name.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'prospect-lgpd-auto-delete',
      '0 3 * * *',
      $cron$
        -- Log before delete
        INSERT INTO prospect_audit_log (campaign_id, establishment_id, action, actor, details)
        SELECT campaign_id, id, 'deleted_lgpd', 'system',
               jsonb_build_object('reason', 'data_retention_expired', 'deleted_at', now())
        FROM prospect_establishments
        WHERE data_retention_deadline < now()
          AND company_id IS NULL
          AND status NOT IN ('approved', 'committed');

        DELETE FROM prospect_establishments
        WHERE data_retention_deadline < now()
          AND company_id IS NULL
          AND status NOT IN ('approved', 'committed');
      $cron$
    );
  END IF;
END $$;

COMMIT;
