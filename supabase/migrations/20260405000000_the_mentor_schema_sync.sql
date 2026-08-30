-- =============================================================================
-- The Mentor — Schema Sync
-- Projeto Supabase: dpxgegdmdusotjiriwrp
--
-- PROBLEMA: whatsapp-inbound (função RevOS deployada no The Mentor) falha
-- silenciosamente ao inserir mensagens porque o schema do The Mentor está
-- desatualizado — missing colunas adicionadas nas migrations de Mar 2026.
--
-- SINTOMAS:
--   1. Mensagens WA chegam no webhook → NÃO aparecem no Omni
--   2. messages INSERT falha com "column X does not exist" → logged, retorna 200
--   3. Outbound stuck em status='pending' com wa_phone_number_id=null
--   4. Buffer entries criadas sem wa_phone_number_id → AI nunca processa
--
-- APLICAR NO SUPABASE SQL EDITOR do projeto dpxgegdmdusotjiriwrp
-- IDEMPOTENTE: seguro para rodar mais de uma vez (IF NOT EXISTS / DROP IF EXISTS)
-- =============================================================================

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. messages — Adicionar colunas ausentes
-- ══════════════════════════════════════════════════════════════════════════════

-- wa_message_id: dedup de mensagens inbound + leitura de receipts (n8n-waa-3)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS wa_message_id text;

-- wa_phone_number_id: canal WA origem/destino (20260303130000)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text;

-- source_type: módulo de origem da mensagem (20260303200000 + 20260308000000)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS source_type text;

-- metadata: JSONB genérico (wa_from, wa_phone_number_id, delay_minutes, etc.)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- module_ref_id: referência ao registro de origem (campaign, form, etc.)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS module_ref_id uuid;

-- execution_id: FK para ai_agents_execution_log (n8n-waa-3)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS execution_id uuid;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. messages — Atualizar CHECK constraints
-- ══════════════════════════════════════════════════════════════════════════════

-- from_contact: adicionar 'agente_ia' e 'sistema'
-- Original Mentor: ('cliente', 'humano', 'ia')
-- RevOS atual:     ('cliente', 'humano', 'ia', 'agente_ia', 'sistema')
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_from_contact_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_from_contact_check
  CHECK (from_contact = ANY (ARRAY[
    'cliente'::text,
    'humano'::text,
    'ia'::text,
    'agente_ia'::text,
    'sistema'::text
  ]));

-- status: adicionar 'sending' (necessário para claim_pending_messages)
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_status_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'sending'::text,
    'sent'::text,
    'delivered'::text,
    'read'::text,
    'error'::text
  ]));

-- source_type: constraint com todos os valores canônicos
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_source_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_source_type_check
  CHECK (source_type IN (
    'inbound',
    'manual',
    'ai_agent',
    'campaign',
    'form',
    'followup',
    'appointment_reminder'
  ));

-- channel: adicionar 'instagram', 'telefone'
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_channel_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_channel_check
  CHECK (channel = ANY (ARRAY[
    'whatsapp'::text,
    'instagram'::text,
    'email'::text,
    'sms'::text,
    'telefone'::text
  ]));

-- message_type: adicionar 'arquivo' (documento), 'chamada', etc.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (message_type = ANY (ARRAY[
    'texto'::text,
    'audio'::text,
    'imagem'::text,
    'video'::text,
    'documento'::text,
    'chamada'::text,
    'comentario'::text,
    'story_reply'::text,
    'story_mention'::text,
    'reply_comentario'::text,
    'arquivo'::text
  ]));

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. messages — Indexes para as novas colunas
-- ══════════════════════════════════════════════════════════════════════════════

-- Dedup: previne gravar 2x a mesma mensagem inbound do WA
CREATE UNIQUE INDEX IF NOT EXISTS messages_wa_message_id_unique
  ON public.messages (wa_message_id)
  WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_wa_phone_number_id
  ON public.messages (wa_phone_number_id)
  WHERE wa_phone_number_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_source_type
  ON public.messages (source_type)
  WHERE source_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_pending_delivery
  ON public.messages (channel, created_at)
  WHERE status = 'pending' AND from_contact != 'cliente';

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. message_buffer — Adicionar wa_phone_number_id
-- ══════════════════════════════════════════════════════════════════════════════
-- Sem esta coluna, pushToBuffer falha inteiramente → AI nunca processa
-- → nunca há outbound messages do agente

ALTER TABLE public.message_buffer
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text;

CREATE INDEX IF NOT EXISTS idx_message_buffer_wa_phone_number_id
  ON public.message_buffer (wa_phone_number_id)
  WHERE wa_phone_number_id IS NOT NULL;

COMMENT ON COLUMN public.message_buffer.wa_phone_number_id IS
  'Meta WA phone_number_id que recebeu a mensagem inbound — usado por ai-agent-execute para routing e como fallback de phoneNumberId no outbound';

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. settings_whatsapp_channels — Adicionar app_secret
-- ══════════════════════════════════════════════════════════════════════════════
-- Sem esta coluna, SELECT('active, access_token, app_secret') retorna erro
-- PostgREST → channelConfig=null → whatsapp-inbound perde o access_token do canal

ALTER TABLE public.settings_whatsapp_channels
  ADD COLUMN IF NOT EXISTS app_secret text;

COMMENT ON COLUMN public.settings_whatsapp_channels.app_secret IS
  'Meta App Secret para validação de assinatura HMAC-SHA256 dos webhooks (x-hub-signature-256). Se nulo, usa WHATSAPP_APP_SECRET env var como fallback.';

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. claim_pending_messages RPC — Criação atômica para omni-delivery-engine
-- ══════════════════════════════════════════════════════════════════════════════
-- Sem esta função, omni-delivery-engine não consegue coletar mensagens pending
-- → mensagens ficam presas em status='pending' eternamente

DROP FUNCTION IF EXISTS claim_pending_messages(int, int, uuid, text);

CREATE OR REPLACE FUNCTION claim_pending_messages(
  p_batch_size    int  DEFAULT 20,
  p_max_age_hours int  DEFAULT 24,
  p_people_id     uuid DEFAULT NULL,
  p_channel       text DEFAULT NULL
)
RETURNS TABLE (
  id                   bigint,
  channel              text,
  content              text,
  message_type         text,
  media_url            text,
  media_metadata       jsonb,
  people_id            uuid,
  lead_id              uuid,
  user_id              uuid,
  source_type          text,
  module_ref_id        uuid,
  whatsapp_template_id text,
  wa_phone_number_id   text,
  execution_id         uuid,
  metadata             jsonb,
  sent_at              timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE messages m_upd
    SET status = 'sending'
    WHERE m_upd.id IN (
      SELECT m.id
      FROM messages m
      WHERE m.status = 'pending'
        AND m.from_contact != 'cliente'
        AND m.created_at > now() - (p_max_age_hours || ' hours')::interval
        AND (p_people_id IS NULL OR m.people_id = p_people_id)
        AND (p_channel IS NULL OR m.channel = p_channel)
        AND (
          (m.metadata->>'delay_minutes') IS NULL
          OR (m.metadata->>'delay_minutes')::int = 0
          OR (
            COALESCE(m.sent_at, m.created_at)
            + ((m.metadata->>'delay_minutes')::int * interval '1 minute')
            <= now()
          )
        )
      ORDER BY m.id ASC
      LIMIT p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      m_upd.id,
      m_upd.channel,
      m_upd.content,
      m_upd.message_type,
      m_upd.media_url,
      m_upd.media_metadata,
      m_upd.people_id,
      m_upd.lead_id,
      m_upd.user_id,
      m_upd.source_type,
      m_upd.module_ref_id,
      m_upd.whatsapp_template_id,
      m_upd.wa_phone_number_id,
      m_upd.execution_id,
      m_upd.metadata,
      m_upd.sent_at
  )
  SELECT * FROM claimed ORDER BY claimed.id ASC;
END;
$$;

COMMENT ON FUNCTION claim_pending_messages IS
  'Atomicamente transiciona mensagens pending → sending. Usa FOR UPDATE SKIP LOCKED para evitar duplicação quando múltiplas instâncias do omni-delivery-engine correm simultaneamente.';

-- Permissão exclusiva para service_role
REVOKE ALL ON FUNCTION claim_pending_messages(int, int, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_pending_messages(int, int, uuid, text) TO service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. reset_stale_sending_messages — Safety valve para 'sending' presos
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION reset_stale_sending_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE messages
  SET status = 'pending'
  WHERE status = 'sending'
    AND created_at < now() - interval '5 minutes';
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 8. Cleanup — Desbloquear ai_processing_lock presos
-- ══════════════════════════════════════════════════════════════════════════════

DO $lock_cleanup$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients_people'
      AND column_name = 'ai_processing_lock'
  ) THEN
    UPDATE public.clients_people
      SET ai_processing_lock = false
      WHERE ai_processing_lock = true;
  END IF;
END $lock_cleanup$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 9. Cleanup — Marcar buffer entries orphãs como processadas
-- ══════════════════════════════════════════════════════════════════════════════
-- Entries sem wa_phone_number_id criadas antes desta migration nunca seriam
-- processadas corretamente pelo ai-agent-execute

UPDATE public.message_buffer
  SET processed = true,
      processed_at = now()
  WHERE processed = false
    AND created_at < now() - interval '1 hour';

-- ══════════════════════════════════════════════════════════════════════════════
-- 10. Backfill — wa_phone_number_id em mensagens outbound pending
-- ══════════════════════════════════════════════════════════════════════════════
-- Outbound messages stuck em pending com wa_phone_number_id=null:
-- resolve usando o canal default do The Mentor (phone_number_id='1019418507930303')

UPDATE public.messages m
SET wa_phone_number_id = '1019418507930303'
WHERE m.status = 'pending'
  AND m.from_contact != 'cliente'
  AND m.wa_phone_number_id IS NULL
  AND m.channel = 'whatsapp';

-- ══════════════════════════════════════════════════════════════════════════════
-- 11. pg_cron — Garantir jobs registrados
-- ══════════════════════════════════════════════════════════════════════════════
-- Nota: requer pg_cron habilitado e app.supabase_url + app.service_role_key
-- configurados via ALTER DATABASE postgres SET app.xxx = '...'

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'reset-stale-sending',
      '*/5 * * * *',
      $cmd$ SELECT reset_stale_sending_messages(); $cmd$
    );
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- PÓS-MIGRATION — Ações manuais obrigatórias no Supabase SQL Editor:
--
-- 1. Configurar DB settings (se não configurado):
--    ALTER DATABASE postgres SET app.supabase_url = 'https://dpxgegdmdusotjiriwrp.supabase.co';
--    ALTER DATABASE postgres SET app.service_role_key = 'sua_service_role_key_aqui';
--
-- 2. Deploy das edge functions (terminal local apontando para o projeto The Mentor):
--    supabase functions deploy whatsapp-inbound --no-verify-jwt
--    supabase functions deploy ai-agent-execute
--    supabase functions deploy omni-delivery-engine
--    supabase functions deploy whatsapp-outbound --no-verify-jwt
--
-- 3. Verificar agente em ai_agents:
--    SELECT id, active, pipeline_id, wa_phone_number_id, llm_provider_id
--    FROM ai_agents WHERE active = true;
--    (pipeline_id deve estar configurado; wa_phone_number_id pode ser null para fallback)
--
-- 4. Testar: enviar mensagem WA e verificar:
--    SELECT id, people_id, from_contact, source_type, wa_phone_number_id, status, created_at
--    FROM messages ORDER BY created_at DESC LIMIT 5;
-- =============================================================================
