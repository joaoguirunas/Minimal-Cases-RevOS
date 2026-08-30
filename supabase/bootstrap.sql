-- RevOS / BAETA — Bootstrap de runtime para um projeto Supabase novo
-- ═══════════════════════════════════════════════════════════════════════════════
-- Rode isto DEPOIS de aplicar supabase/schema.sql e supabase/seed.sql, e DEPOIS
-- de criar o secret 'service_role_cron' no Vault (ver README "Setup do zero").
--
-- Troque os dois placeholders antes de rodar:
--   __SUPABASE_URL__   -> https://<seu-project-ref>.supabase.co
-- ═══════════════════════════════════════════════════════════════════════════════

-- Extensões que o schema.sql (dump de estrutura) não inclui
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

-- _app_config: URL real do seu projeto
INSERT INTO public._app_config (key, value) VALUES ('supabase_url', '__SUPABASE_URL__')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Sincroniza service_role_key a partir do Vault (requer secret 'service_role_cron' já criado)
SELECT public.sync_service_role_from_vault();

-- Recria os 7 cron jobs internos, apontando pro SEU projeto
SELECT cron.schedule(
  'whatsapp_templates_auto_sync',
  '*/20 * * * *',
  $$SELECT public.secure_http_post('service_role_cron','__SUPABASE_URL__/functions/v1/whatsapp-templates-sync','{}'::jsonb,'whatsapp-templates-auto-sync-cron');$$
);

SELECT cron.schedule(
  'ai-agent-watchdog',
  '*/2 * * * *',
  $$SELECT public.ai_agent_watchdog();$$
);

SELECT cron.schedule(
  'process-meeting-followups',
  '*/5 * * * *',
  $$SELECT public.secure_http_post('service_role_cron','__SUPABASE_URL__/functions/v1/process-meeting-followups','{}'::jsonb,'process-meeting-followups-cron');$$
);

SELECT cron.schedule(
  'sends-dispatch-batch',
  '* * * * *',
  $$SELECT public.trigger_sends_dispatch_batch()$$
);

SELECT cron.schedule(
  'kiwify_reconcile',
  '0 */6 * * *',
  $$SELECT public.secure_http_post('service_role_cron','__SUPABASE_URL__/functions/v1/kiwify-reconcile','{"source":"pg_cron"}'::jsonb,'kiwify-reconcile-cron');$$
);

SELECT cron.schedule(
  'ai-callback-worker-1min',
  '* * * * *',
  $$SELECT public.secure_http_post('service_role_cron','__SUPABASE_URL__/functions/v1/ai-callback-worker','{"source":"pg_cron"}'::jsonb,'ai-callback-worker-cron');$$
);

SELECT cron.schedule(
  'followup-trigger-worker-1min',
  '* * * * *',
  $$SELECT public.trigger_followup_worker();$$
);

-- Valide: SELECT * FROM public.trigger_fwup01_smoke_test();  -- todos os checks devem dar PASS
