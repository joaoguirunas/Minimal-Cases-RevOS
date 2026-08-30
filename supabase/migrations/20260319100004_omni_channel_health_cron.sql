-- OMNI PRO™ Channel Health Check — pg_cron Schedule
-- Epic: EPIC-OMNI-PRO-V2 | Story: OP-05
-- Runs every 15 minutes to probe active channels

-- ── 1. PL/pgSQL function ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_omni_channel_health_check()
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
    RAISE WARNING 'trigger_omni_channel_health_check: _app_config missing';
    RETURN;
  END IF;

  -- Only trigger if there are active channels
  IF NOT EXISTS (
    SELECT 1 FROM omni_channel_configs
    WHERE is_active = true
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/omni-channel-health-check',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION trigger_omni_channel_health_check() IS
  'Disparada pelo pg_cron a cada 15 minutos. '
  'Probes de conectividade para canais ativos (WhatsApp, Instagram, Email, SMS, Telefone).';

-- ── 2. Remover job anterior se existir ──────────────────────────────────────
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'omni-channel-health-check';

-- ── 3. Agendar a cada 15 minutos ────────────────────────────────────────────
SELECT cron.schedule(
  'omni-channel-health-check',
  '*/15 * * * *',
  $$ SELECT trigger_omni_channel_health_check(); $$
);
