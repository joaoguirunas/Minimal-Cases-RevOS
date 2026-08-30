-- KFY-1.6: kiwify-reconcile — pg_cron schedule (every 6h).
--
-- Invokes the kiwify-reconcile edge function through the project's audited
-- secure_http_post() helper (reads the service-role JWT from Vault — never hardcoded,
-- rotation-proof; ADR-SP-05). The edge function accepts that JWT on the Authorization
-- header and authorizes the call by its `role=service_role` claim.
--
-- ⚠️ DELIVERED TO DEVOPS — apply manually via `supabase db query --linked --file`, then
--    register in supabase_migrations.schema_migrations. Do NOT apply from the dev agent.
--
-- PREREQUISITE (manual, one-time): a Vault secret named 'service_role_cron' holding the
-- project's service_role JWT must exist (same as whatsapp_templates_auto_sync). If absent,
-- the cron job is skipped with a NOTICE and the migration still succeeds.
--
-- DEPLOY NOTE: kiwify-reconcile must be deployed WITHOUT --no-verify-jwt so the gateway
-- validates the JWT signature; the function only reads the role claim.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_has_secret boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'service_role_cron'
  ) INTO v_has_secret;

  IF NOT v_has_secret THEN
    RAISE NOTICE 'Vault secret service_role_cron not found — skipping kiwify_reconcile cron. Add the secret and re-run this migration.';
    RETURN;
  END IF;

  -- Idempotent: remove any prior registration before (re)scheduling.
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'kiwify_reconcile';

  -- Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC).
  PERFORM cron.schedule(
    'kiwify_reconcile',
    '0 */6 * * *',
    $cron$
    SELECT public.secure_http_post(
      'service_role_cron',
      'https://wotuyxscsfralqpoiyfv.supabase.co/functions/v1/kiwify-reconcile',
      '{"source":"pg_cron"}'::jsonb,
      'kiwify-reconcile-cron'
    );
    $cron$
  );
END $$;

COMMIT;
