-- OMNI PRO™ Dead-Letter Retry — pg_cron Schedule
-- Epic: EPIC-OMNI-PRO-V2 | Story: OP-04
-- Runs every 5 minutes to retry failed deliveries

-- ── 1. PL/pgSQL function ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_omni_retry_dead_letter()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING 'trigger_omni_retry_dead_letter: _app_config missing';
    RETURN;
  END IF;

  -- Only trigger if there are entries ready for retry
  IF NOT EXISTS (
    SELECT 1 FROM omni_delivery_dead_letter
    WHERE status = 'pending'
      AND next_retry_at <= now()
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/omni-retry-dead-letter',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION trigger_omni_retry_dead_letter() IS
  'Disparada pelo pg_cron a cada 5 minutos. '
  'Só chama a edge function se houver dead-letter entries prontas para retry.';

-- ── 2. Remover job anterior se existir ──────────────────────────────────────
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'omni-retry-dead-letter';

-- ── 3. Agendar a cada 5 minutos ────────────────────────────────────────────
SELECT cron.schedule(
  'omni-retry-dead-letter',
  '*/5 * * * *',
  $$ SELECT trigger_omni_retry_dead_letter(); $$
);
