-- FIX-SCH-02: Zoom token auto-refresh via pg_cron
-- Zoom access tokens expire in 1 hour. Proactive refresh every 30 minutes
-- prevents zoom-upsert-event failures for active users.
-- Pattern: same as instagram-token-refresh (SECURITY DEFINER + _app_config)

-- ── 1. PL/pgSQL trigger function ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_zoom_token_refresh()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  svc_key      text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING 'trigger_zoom_token_refresh: _app_config missing supabase_url or service_role_key';
    RETURN;
  END IF;

  -- Only trigger if there are active Zoom connections
  IF NOT EXISTS (
    SELECT 1 FROM user_calendar_connections
    WHERE provider = 'zoom' AND is_active = true
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/zoom-token-refresh',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION trigger_zoom_token_refresh() IS
  'Disparada pelo pg_cron a cada 30 minutos. '
  'Renova tokens Zoom que expiram em menos de 45 minutos. '
  'Só chama a edge function se houver conexão Zoom ativa.';

-- ── 2. Remover job anterior se existir ───────────────────────────────────────

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'zoom-token-refresh';

-- ── 3. Agendar a cada 30 minutos ─────────────────────────────────────────────

SELECT cron.schedule(
  'zoom-token-refresh',
  '*/30 * * * *',
  $$ SELECT trigger_zoom_token_refresh(); $$
);
