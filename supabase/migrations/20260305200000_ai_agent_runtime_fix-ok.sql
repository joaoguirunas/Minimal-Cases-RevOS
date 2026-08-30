-- =============================================================================
-- AI Agent Runtime Fix — Consolidates all missing pieces for agent execution
-- =============================================================================
--
-- PROBLEMA RESOLVIDO:
--   1. message_buffer.wa_phone_number_id ausente → getBufferMessages falha
--      silenciosamente (PostgREST retorna erro ignorado → data=null → buffer
--      vazio → ai-agent-execute retorna nothing_to_process → loop infinito)
--   2. settings_whatsapp_channels.app_secret ausente → whatsapp-inbound falha
--      ao ler credenciais do canal (query errora silenciosamente)
--   3. pg_cron jobs podem ter sido perdidos (garante registro idempotente)
--   4. ai_processing_lock preso em true por crash anterior (libera locks velhos)
--
-- ⚠️  AÇÃO MANUAL OBRIGATÓRIA (não pode ser feita via migration):
--     Execute no SQL Editor do Supabase:
--       ALTER DATABASE postgres SET app.supabase_url = 'https://SEU_PROJECT.supabase.co';
--       ALTER DATABASE postgres SET app.service_role_key = 'SUA_SERVICE_ROLE_KEY';
--     Sem isso, process_message_buffer() retorna silenciosamente sem disparar agentes.
-- =============================================================================


-- ── 1. message_buffer.wa_phone_number_id ─────────────────────────────────────
-- Registra qual canal WA recebeu a mensagem inbound.
-- Usado por ai-agent-execute para: Canal + Pipeline + Stage routing (P1/P2)
-- e como fallback de phoneNumberId no whatsapp-outbound.

ALTER TABLE message_buffer
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text;

CREATE INDEX IF NOT EXISTS idx_message_buffer_wa_phone_number_id
  ON message_buffer (wa_phone_number_id)
  WHERE wa_phone_number_id IS NOT NULL;

COMMENT ON COLUMN message_buffer.wa_phone_number_id IS
  'Meta WA phone_number_id que recebeu a mensagem inbound — usado pelo ai-agent-execute para roteamento Canal+Pipeline+Stage e como fallback de phoneNumberId no outbound';


-- ── 2. settings_whatsapp_channels.app_secret ─────────────────────────────────
-- App Secret por canal para validação de assinatura HMAC-SHA256 do Meta webhook.
-- whatsapp-inbound lê este campo: .select('active, access_token, app_secret')
-- Sem a coluna, PostgREST retorna erro → channelConfig=null → validation skipped.

ALTER TABLE settings_whatsapp_channels
  ADD COLUMN IF NOT EXISTS app_secret text;

COMMENT ON COLUMN settings_whatsapp_channels.app_secret IS
  'Meta App Secret para validação de assinatura HMAC-SHA256 dos webhooks (x-hub-signature-256). Se nulo, usa WHATSAPP_APP_SECRET env var como fallback.';


-- ── 3. Liberar ai_processing_lock presos (safety cleanup) ────────────────────
-- Crashes do ai-agent-execute podem deixar a flag presa em true.
-- release_stale_ai_locks() roda a cada 10 minutos via pg_cron, mas aqui
-- liberamos imediatamente para não bloquear o primeiro processamento pós-deploy.

UPDATE clients_people
  SET ai_processing_lock = false
  WHERE ai_processing_lock = true;


-- ── 4. Marcar buffer entries antigas como processadas (orphan cleanup) ────────
-- Entries do message_buffer criadas antes da coluna wa_phone_number_id existir
-- ficam presas em processed=false mas nunca serão processadas corretamente.
-- Marca como processadas entradas com mais de 1 hora para limpar a fila.

UPDATE message_buffer
  SET processed = true,
      processed_at = now()
  WHERE processed = false
    AND created_at < now() - interval '1 hour';


-- ── 5. Garantir pg_cron jobs registrados ─────────────────────────────────────
-- cron.schedule() é idempotente: cria ou atualiza o job pelo nome.
-- Garante que os jobs existam mesmo se foram perdidos.

-- Process buffer every minute (pg_cron min granularity = 1 min)
SELECT cron.schedule(
  'process-message-buffer',
  '* * * * *',
  'SELECT process_message_buffer()'
);

-- Release stale locks every 10 minutes
SELECT cron.schedule(
  'release-stale-ai-locks',
  '*/10 * * * *',
  'SELECT release_stale_ai_locks()'
);


-- ── 6. Recreate process_message_buffer() com logging melhorado ───────────────
-- Mesma lógica da migration original, com RAISE NOTICE explicativo se os
-- DB settings não estiverem configurados (facilita debug).

CREATE OR REPLACE FUNCTION process_message_buffer()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec           record;
  supabase_url  text;
  svc_key       text;
BEGIN
  supabase_url := current_setting('app.supabase_url', true);
  svc_key      := current_setting('app.service_role_key', true);

  -- Guard: se os settings manuais não foram configurados, avisa no log
  IF supabase_url IS NULL OR supabase_url = '' OR svc_key IS NULL OR svc_key = '' THEN
    RAISE NOTICE 'process_message_buffer: app.supabase_url ou app.service_role_key não configurados. Execute no SQL Editor: ALTER DATABASE postgres SET app.supabase_url = ''...''; ALTER DATABASE postgres SET app.service_role_key = ''...'';';
    RETURN;
  END IF;

  FOR rec IN
    SELECT DISTINCT mb.people_id
    FROM   message_buffer mb
    JOIN   clients_people cp ON cp.id = mb.people_id
    WHERE  mb.processed         = false
      AND  mb.expires_at        < now()
      AND  cp.ai_processing_lock = false
      AND  cp.ai_enabled         = true
    FOR UPDATE OF mb SKIP LOCKED
  LOOP
    UPDATE clients_people
      SET ai_processing_lock = true
      WHERE id = rec.people_id;

    PERFORM net.http_post(
      url     := supabase_url || '/functions/v1/ai-agent-execute',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body    := jsonb_build_object('people_id', rec.people_id)::text
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION process_message_buffer() IS
  'Chamada pelo pg_cron a cada minuto. Encontra buffer entries expiradas e não processadas, adquire ai_processing_lock e dispara ai-agent-execute via pg_net. Requer: app.supabase_url e app.service_role_key configurados no banco.';


-- ── 7. Recreate release_stale_ai_locks() ─────────────────────────────────────

CREATE OR REPLACE FUNCTION release_stale_ai_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clients_people
    SET ai_processing_lock = false
    WHERE ai_processing_lock = true
      AND ai_last_message_at < now() - interval '5 minutes';
END;
$$;

COMMENT ON FUNCTION release_stale_ai_locks() IS
  'Safety valve: libera ai_processing_lock preso por mais de 5 minutos (crash recovery do ai-agent-execute).';


-- ── 8. Fix from_contact='ia' → 'agente_ia' (alinha DB com frontend OMNI) ──────
-- ai-agent-execute usava 'ia' mas o frontend verifica 'agente_ia'.
-- Esta query é idempotente: não altera rows que já têm 'agente_ia'.

UPDATE messages
  SET from_contact = 'agente_ia'
  WHERE from_contact = 'ia';


-- ── FIM ───────────────────────────────────────────────────────────────────────
-- Após aplicar esta migration:
--   1. Configure os DB settings manuais (ver ⚠️ acima)
--   2. Deploy das edge functions:
--        supabase functions deploy whatsapp-inbound --no-verify-jwt
--        supabase functions deploy ai-agent-execute
--        supabase functions deploy whatsapp-outbound --no-verify-jwt
--   3. Verifique o agente em ai_agents: active=true, pipeline_id correto,
--      llm_provider_id apontando para um provider com api_key configurada.
