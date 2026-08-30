-- OMNI PRO™ Delivery Engine — pg_cron scheduler
-- Sprint 2 — Aciona omni-delivery-engine a cada minuto via _app_config (mesmo padrão do process_message_buffer)
-- Migration: 20260308020000

-- ── 1. Função PL/pgSQL que dispara a edge function ────────────────────────────
-- SECURITY DEFINER → lê _app_config sem RLS (igual ao process_message_buffer)

CREATE OR REPLACE FUNCTION trigger_omni_delivery_engine()
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
    RAISE WARNING 'trigger_omni_delivery_engine: _app_config missing supabase_url or service_role_key';
    RETURN;
  END IF;

  -- Só dispara se houver mensagens pending (evita chamadas desnecessárias)
  IF NOT EXISTS (
    SELECT 1 FROM messages
    WHERE status = 'pending'
      AND from_contact != 'cliente'
      AND created_at > now() - interval '24 hours'
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/omni-delivery-engine',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION trigger_omni_delivery_engine() IS
  'Disparada pelo pg_cron a cada minuto. '
  'Só chama a edge function omni-delivery-engine se houver mensagens status=pending. '
  'Lê credenciais de _app_config (SECURITY DEFINER).';

-- ── 2. Remover job anterior se existir ───────────────────────────────────────
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'omni-delivery-engine';

-- ── 3. Agendar a cada minuto ──────────────────────────────────────────────────
SELECT cron.schedule(
  'omni-delivery-engine',
  '* * * * *',
  $$ SELECT trigger_omni_delivery_engine(); $$
);
