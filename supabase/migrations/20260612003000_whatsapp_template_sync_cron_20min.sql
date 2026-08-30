-- FIX-WA-TEMPLATE-SYNC-CRON-401 — corrige o cron de auto-sync de templates WhatsApp.
--
-- ROOT CAUSE REAL (a hipótese original de "Vault service_role_cron defasado" estava
-- ERRADA): o Vault secret `service_role_cron` É a service_role key legacy correta
-- (passa o gateway). O 401 vinha da PRÓPRIA função: ela autorizava o cron via
-- `bearer === SUPABASE_SERVICE_ROLE_KEY` (string match), mas após a migração do
-- projeto para o novo sistema de API keys (rotação em 2026-06-12 00:11 UTC) o
-- `SUPABASE_SERVICE_ROLE_KEY` injetado no runtime da função deixou de bater
-- byte-a-byte com o JWT legacy guardado no Vault. Resultado: cron 401 em 100%.
--
-- FIX (no código da edge function, fora desta migration — ver
-- supabase/functions/whatsapp-templates-sync/index.ts): a função passa a tratar
-- como cron QUALQUER Bearer que o gateway já validou como JWT `role=service_role`
-- (decodifica o payload), em vez de exigir igualdade literal com a key volátil.
-- À prova de rotação. Deploy: `supabase functions deploy whatsapp-templates-sync
-- --no-verify-jwt`.
--
-- Esta migration cobre apenas a parte SQL: reduzir a frequência do cron de */5
-- para */20 (decisão do usuário, 2026-06-12). Idempotente — cron.schedule faz
-- upsert por jobname.

BEGIN;

DO $$
DECLARE
  v_has_secret boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'service_role_cron'
  ) INTO v_has_secret;

  IF NOT v_has_secret THEN
    RAISE NOTICE 'Vault secret service_role_cron not found — skipping whatsapp_templates_auto_sync cron reschedule.';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'whatsapp_templates_auto_sync',
    '*/20 * * * *',
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
