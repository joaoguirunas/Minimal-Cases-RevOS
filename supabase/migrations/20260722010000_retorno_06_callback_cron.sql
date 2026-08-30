-- RETORNO-06: agenda o pg_cron que dispara o ai-callback-worker a cada minuto,
-- mesmo padrão já em produção (kiwify_reconcile, process-meeting-followups,
-- whatsapp_templates_auto_sync): secure_http_post() com o Vault secret
-- 'service_role_cron' (já existe e foi verificado válido para este projeto
-- em 2026-07-22 — a nota de "nunca criado" na smart-memory estava
-- desatualizada, o secret foi criado em 2026-06-10 pelo team template-sync).
--
-- Idempotente: cron.unschedule antes do schedule, IF EXISTS no rollback.

BEGIN;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'ai-callback-worker-1min';

SELECT cron.schedule(
  'ai-callback-worker-1min',
  '* * * * *',
  $$
  SELECT public.secure_http_post(
    'service_role_cron',
    'https://wotuyxscsfralqpoiyfv.supabase.co/functions/v1/ai-callback-worker',
    '{"source":"pg_cron"}'::jsonb,
    'ai-callback-worker-cron'
  );
  $$
);

COMMIT;

-- Rollback: SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ai-callback-worker-1min';
-- Desliga o disparo sem tocar nas tabelas nem no agente — retornos pendentes ficam
-- 'pending' e disparam normalmente assim que o cron for religado.
