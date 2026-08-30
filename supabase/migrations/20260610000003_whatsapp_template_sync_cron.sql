-- WAT-SYNC-02: Auto-sync WhatsApp templates via pg_cron every 5 minutes.
--
-- Adds last_synced_at tracking and schedules a cron job that invokes the
-- whatsapp-templates-sync edge function through the project's existing
-- secure_http_post() helper (reads the service-role JWT from Vault — never
-- hardcoded). The edge function accepts that service-role JWT on the
-- Authorization header as a cron bypass for its normal user-JWT auth.
--
-- PREREQUISITE (manual, one-time): a Vault secret named 'service_role_cron'
-- holding the project's service_role JWT must exist. If it is absent, the
-- cron job is skipped and a NOTICE is emitted — the migration still succeeds.

BEGIN;

-- ── 1. last_synced_at column ────────────────────────────────────────────────
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- ── 2. Required extensions ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 3. Schedule the auto-sync cron job ──────────────────────────────────────
DO $$
DECLARE
  v_has_secret boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'service_role_cron'
  ) INTO v_has_secret;

  IF NOT v_has_secret THEN
    RAISE NOTICE 'Vault secret service_role_cron not found — skipping whatsapp_templates_auto_sync cron. Add the secret and re-run this migration.';
    RETURN;
  END IF;

  -- Remove any prior registration so re-running is idempotent.
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'whatsapp_templates_auto_sync';

  PERFORM cron.schedule(
    'whatsapp_templates_auto_sync',
    '*/5 * * * *',
    $cron$
    SELECT public.secure_http_post(
      'service_role_cron',
      'https://wotuyxscsfralqpoiyfv.supabase.co/functions/v1/whatsapp-templates-sync',
      '{"channel_id": "eced709d-a50c-44aa-a844-b787119f9e1b"}'::jsonb,
      'whatsapp-templates-auto-sync-cron'
    );
    $cron$
  );
END $$;

COMMIT;
