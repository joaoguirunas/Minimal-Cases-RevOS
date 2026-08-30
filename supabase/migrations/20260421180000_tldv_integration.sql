-- tl;dv Integration — Meeting Records + Channel Config + pg_cron daily sync
-- Story: TLDV-1.1
-- Migration: 20260421180000

-- ── 1. Campos tl;dv em meeting_records ────────────────────────────────────────

ALTER TABLE public.meeting_records
  ADD COLUMN IF NOT EXISTS tldv_meeting_id text,
  ADD COLUMN IF NOT EXISTS transcript_json jsonb,
  ADD COLUMN IF NOT EXISTS highlights      text[];

-- Índice único: evita duplicados e permite lookup rápido por tl;dv ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_records_tldv_id
  ON public.meeting_records(tldv_meeting_id)
  WHERE tldv_meeting_id IS NOT NULL;

-- ── 2. Adicionar 'tldv' ao CHECK constraint de omni_channel_configs.channel ──
-- A coluna channel tem CHECK (channel IN ('whatsapp','instagram','email','sms','telefone')).
-- É necessário dropar e recriar o constraint para incluir 'tldv'.

ALTER TABLE public.omni_channel_configs
  DROP CONSTRAINT IF EXISTS omni_channel_configs_channel_check;

ALTER TABLE public.omni_channel_configs
  ADD CONSTRAINT omni_channel_configs_channel_check
  CHECK (channel IN ('whatsapp', 'instagram', 'email', 'sms', 'telefone', 'identity_collection', 'tldv'));

-- ── 3. Seed: linha de configuração tl;dv ──────────────────────────────────────

INSERT INTO public.omni_channel_configs (channel, display_name, credentials, is_active)
VALUES ('tldv', 'tldv', '{}', false)
ON CONFLICT (channel) DO UPDATE SET display_name = COALESCE(omni_channel_configs.display_name, 'tldv');

-- ── 4. pg_cron — sync diário às 02:00 UTC ────────────────────────────────────
-- Padrão do projecto: SECURITY DEFINER + _app_config (igual ao omni-delivery-engine)

CREATE OR REPLACE FUNCTION trigger_tldv_daily_sync()
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
    RAISE WARNING 'trigger_tldv_daily_sync: _app_config missing supabase_url or service_role_key';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/tldv-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"days": 1}'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION trigger_tldv_daily_sync() IS
  'Disparada pelo pg_cron diariamente às 02:00 UTC. '
  'Invoca a edge function tldv-sync para importar reuniões do dia anterior. '
  'Lê credenciais de _app_config (SECURITY DEFINER).';

-- Remover job anterior se existir
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'tldv-daily-sync';

-- Agendar diariamente às 02:00 UTC
SELECT cron.schedule(
  'tldv-daily-sync',
  '0 2 * * *',
  $$ SELECT trigger_tldv_daily_sync(); $$
);
