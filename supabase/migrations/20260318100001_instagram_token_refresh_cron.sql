-- Instagram Token Auto-Refresh — pg_cron Schedule
-- Epic: EPIC-OMNI-PRO-V2 | Story: OP-03
-- Runs daily at 03:00 UTC to check/refresh Instagram OAuth token
-- Pattern: same as omni-delivery-engine (SECURITY DEFINER + _app_config)

-- ── 1. PL/pgSQL function ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_instagram_token_refresh()
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
    RAISE WARNING 'trigger_instagram_token_refresh: _app_config missing supabase_url or service_role_key';
    RETURN;
  END IF;

  -- Only trigger if instagram channel is active
  IF NOT EXISTS (
    SELECT 1 FROM omni_channel_configs
    WHERE channel = 'instagram' AND is_active = true
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/instagram-token-refresh',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION trigger_instagram_token_refresh() IS
  'Disparada pelo pg_cron diariamente às 03:00 UTC. '
  'Só chama a edge function se canal Instagram estiver ativo. '
  'Lê credenciais de _app_config (SECURITY DEFINER).';

-- ── 2. Remover job anterior se existir ──────────────────────────────────────
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'instagram-token-refresh';

-- ── 3. Agendar daily às 03:00 UTC ──────────────────────────────────────────
SELECT cron.schedule(
  'instagram-token-refresh',
  '0 3 * * *',
  $$ SELECT trigger_instagram_token_refresh(); $$
);
