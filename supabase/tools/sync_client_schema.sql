-- =============================================================================
-- RevOS — Client Schema Sync
-- Idempotent: safe to run multiple times. No hardcoded client data.
-- Apply on each client's Supabase SQL Editor (not the main bank).
--
-- Covers all objects added after Feb 2026 that may be missing on clients
-- provisioned before March 2026.
--
-- Baseline ref : ohzwetkaazgxafubzvop
-- Generated   : 2026-04-10
-- =============================================================================

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. message_buffer — create table if missing entirely
--    (added by n8n-waa-3, 2026-03-02)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.message_buffer (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id      uuid        NOT NULL REFERENCES public.clients_people(id) ON DELETE CASCADE,
  messages       jsonb[]     NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  processed      boolean     NOT NULL DEFAULT false,
  processed_at   timestamptz,
  wa_phone_number_id text,
  channel_type   text
);

ALTER TABLE public.message_buffer ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_buffer'
      AND policyname = 'message_buffer_service_role_only'
  ) THEN
    CREATE POLICY "message_buffer_service_role_only"
      ON public.message_buffer FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS message_buffer_ready_to_process
  ON public.message_buffer (people_id, expires_at)
  WHERE processed = false;

-- Columns that may be missing if table existed but was old
ALTER TABLE public.message_buffer
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text,
  ADD COLUMN IF NOT EXISTS channel_type text;

CREATE INDEX IF NOT EXISTS idx_message_buffer_wa_phone_number_id
  ON public.message_buffer (wa_phone_number_id)
  WHERE wa_phone_number_id IS NOT NULL;

COMMENT ON TABLE  public.message_buffer IS 'Inbound message debounce buffer. Processed by pg_cron every 5s.';
COMMENT ON COLUMN public.message_buffer.wa_phone_number_id IS 'Meta WA phone_number_id that received the inbound — used by ai-agent-execute for routing';
COMMENT ON COLUMN public.message_buffer.channel_type IS 'Channel type: whatsapp | instagram — used by ai-agent-execute for agent selection';


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. settings_whatsapp_channels — create table if missing entirely
--    (added by n8n-waa-6, 2026-03-02)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.settings_whatsapp_channels (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label          text        NOT NULL,
  phone_number_id text       NOT NULL UNIQUE,
  access_token   text        NOT NULL,
  is_default     boolean     NOT NULL DEFAULT false,
  active         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  app_secret     text,
  waba_id        text
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_channels_one_default
  ON public.settings_whatsapp_channels (is_default)
  WHERE is_default = true AND active = true;

ALTER TABLE public.settings_whatsapp_channels ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'settings_whatsapp_channels'
      AND policyname = 'wa_channels_admin_all'
  ) THEN
    CREATE POLICY "wa_channels_admin_all"
      ON public.settings_whatsapp_channels FOR ALL TO authenticated
      USING (is_admin_or_manager())
      WITH CHECK (is_admin_or_manager());
  END IF;
END $$;

-- Columns that may be missing if table existed but was old
ALTER TABLE public.settings_whatsapp_channels
  ADD COLUMN IF NOT EXISTS app_secret text,
  ADD COLUMN IF NOT EXISTS waba_id text;

COMMENT ON COLUMN public.settings_whatsapp_channels.app_secret IS 'Meta App Secret — validates x-hub-signature-256 on inbound webhooks';
COMMENT ON COLUMN public.settings_whatsapp_channels.waba_id IS 'WhatsApp Business Account ID';


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. messages — add missing columns
-- ══════════════════════════════════════════════════════════════════════════════

-- wa_message_id: dedup + read receipts (n8n-waa-3, 2026-03-02)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS wa_message_id text;

-- execution_id: FK to ai_agents_execution_log (n8n-waa-3, 2026-03-02)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS execution_id uuid;

-- wa_phone_number_id: canal WA origem/destino (2026-03-03)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text;

-- source_type: module origin (2026-03-08)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS source_type text;

-- module_ref_id: polymorphic ref to originating record (2026-03-08)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS module_ref_id uuid;

-- metadata: generic JSONB (delay_minutes, wa_from, etc.)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- ig_message_id: instagram DM dedup (2026-03-08)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS ig_message_id text;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS messages_wa_message_id_unique
  ON public.messages (wa_message_id)
  WHERE wa_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS messages_ig_message_id_key
  ON public.messages (ig_message_id)
  WHERE ig_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_wa_phone_number_id
  ON public.messages (wa_phone_number_id)
  WHERE wa_phone_number_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_source_type
  ON public.messages (source_type)
  WHERE source_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_module_ref_id
  ON public.messages (module_ref_id)
  WHERE module_ref_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_pending_delivery
  ON public.messages (channel, created_at)
  WHERE status = 'pending' AND from_contact != 'cliente';


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. messages — update CHECK constraints to canonical values
-- ══════════════════════════════════════════════════════════════════════════════

-- from_contact: add 'agente_ia', 'sistema'
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

-- status: add 'sending' (required by claim_pending_messages)
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

-- source_type: full canonical list
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

-- channel: add 'instagram', 'telefone'
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

-- message_type: add 'arquivo', 'chamada', 'comentario', etc.
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
-- 5. clients_people — AI agent fields
--    (n8n-waa-3: 2026-03-02 | omni_identity_unification: 2026-03-06)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS ai_last_message_at  timestamptz,
  ADD COLUMN IF NOT EXISTS ai_processing_lock  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_handle    text,
  ADD COLUMN IF NOT EXISTS merged_into_id      uuid REFERENCES public.clients_people(id),
  ADD COLUMN IF NOT EXISTS merge_history       jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.clients_people.ai_processing_lock IS 'Lock flag: prevents concurrent ai-agent-execute for same person';
COMMENT ON COLUMN public.clients_people.ai_last_message_at IS 'Timestamp of last inbound message for pg_cron debounce';


-- ══════════════════════════════════════════════════════════════════════════════
-- 6. ai_agents — new fields
--    (n8n-waa-6: 2026-03-02 | ai_agents_multi_select: 2026-03-03)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS wa_channel_id  uuid REFERENCES public.settings_whatsapp_channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel_types  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stage_ids      text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.ai_agents.wa_channel_id IS 'FK to settings_whatsapp_channels — which WA number this agent sends from';


-- ══════════════════════════════════════════════════════════════════════════════
-- 7. RPC: claim_pending_messages — atomic delivery claim
--    (latest version from baseline — uses FOR UPDATE SKIP LOCKED)
-- ══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.claim_pending_messages(int, int, uuid, text);

CREATE OR REPLACE FUNCTION public.claim_pending_messages(
  p_batch_size    integer DEFAULT 20,
  p_max_age_hours integer DEFAULT 24,
  p_people_id     uuid    DEFAULT NULL,
  p_channel       text    DEFAULT NULL
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
      m_upd.id, m_upd.channel, m_upd.content, m_upd.message_type,
      m_upd.media_url, m_upd.media_metadata, m_upd.people_id, m_upd.lead_id,
      m_upd.user_id, m_upd.source_type, m_upd.module_ref_id,
      m_upd.whatsapp_template_id, m_upd.wa_phone_number_id,
      m_upd.execution_id, m_upd.metadata, m_upd.sent_at
  )
  SELECT * FROM claimed ORDER BY claimed.id ASC;
END;
$$;

COMMENT ON FUNCTION public.claim_pending_messages IS
  'Atomically transitions messages pending → sending. FOR UPDATE SKIP LOCKED prevents duplication with concurrent omni-delivery-engine instances.';

REVOKE ALL ON FUNCTION public.claim_pending_messages(int, int, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_messages(int, int, uuid, text) TO service_role;


-- ══════════════════════════════════════════════════════════════════════════════
-- 8. RPC: reset_stale_sending_messages — safety valve
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reset_stale_sending_messages()
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

COMMENT ON FUNCTION public.reset_stale_sending_messages IS
  'Resets messages stuck in sending status for > 5 minutes back to pending. Called by pg_cron every 5 minutes.';


-- ══════════════════════════════════════════════════════════════════════════════
-- 9. RPC: trigger_omni_delivery_engine — pg_cron trigger function
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trigger_omni_delivery_engine()
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
    RAISE WARNING 'trigger_omni_delivery_engine: _app_config missing supabase_url or service_role_key';
    RETURN;
  END IF;

  -- Only fire if there are pending messages (avoid unnecessary calls)
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

COMMENT ON FUNCTION public.trigger_omni_delivery_engine IS
  'Called by pg_cron every minute. Only fires the edge function if pending messages exist. Reads credentials from _app_config.';


-- ══════════════════════════════════════════════════════════════════════════════
-- 10. pg_cron — register jobs
--     Requires: pg_cron extension enabled + _app_config.supabase_url and
--     _app_config.service_role_key populated (ALTER DATABASE SET app.xxx)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- omni-delivery-engine: fires every minute
    PERFORM cron.unschedule(jobid)
    FROM cron.job WHERE jobname = 'omni-delivery-engine';

    PERFORM cron.schedule(
      'omni-delivery-engine',
      '* * * * *',
      $cmd$ SELECT public.trigger_omni_delivery_engine(); $cmd$
    );

    -- reset-stale-sending: fires every 5 minutes
    PERFORM cron.unschedule(jobid)
    FROM cron.job WHERE jobname = 'reset-stale-sending';

    PERFORM cron.schedule(
      'reset-stale-sending',
      '*/5 * * * *',
      $cmd$ SELECT public.reset_stale_sending_messages(); $cmd$
    );

  ELSE
    RAISE WARNING 'pg_cron not enabled — omni-delivery-engine and reset-stale-sending cron jobs NOT registered. Enable pg_cron in Supabase dashboard extensions.';
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 11. Updated_at trigger for settings_whatsapp_channels (if missing)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.settings_whatsapp_channels_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'whatsapp_channels_updated_at'
      AND tgrelid = 'public.settings_whatsapp_channels'::regclass
  ) THEN
    CREATE TRIGGER whatsapp_channels_updated_at
      BEFORE UPDATE ON public.settings_whatsapp_channels
      FOR EACH ROW EXECUTE FUNCTION public.settings_whatsapp_channels_set_updated_at();
  END IF;
END $$;


COMMIT;

-- =============================================================================
-- POST-SYNC: Manual steps required after running this script
--
-- 1. Verify _app_config is populated:
--    SELECT key, LEFT(value,30) AS value_preview FROM _app_config
--    WHERE key IN ('supabase_url', 'service_role_key');
--
--    If empty, run:
--    ALTER DATABASE postgres SET app.supabase_url = 'https://{project_ref}.supabase.co';
--    ALTER DATABASE postgres SET app.service_role_key = '{service_role_key}';
--    (then restart the session for changes to take effect)
--
-- 2. Deploy edge functions pointing to THIS client's project:
--    supabase functions deploy whatsapp-inbound --no-verify-jwt
--    supabase functions deploy ai-agent-execute
--    supabase functions deploy omni-delivery-engine
--    supabase functions deploy whatsapp-outbound --no-verify-jwt
--
-- 3. Verify cron jobs registered (if pg_cron is enabled):
--    SELECT jobname, schedule, active FROM cron.job;
--
-- 4. Verify audit passes:
--    Run supabase/tools/audit_client.sql — all rows should show PASS.
--
-- 5. Register in main bank:
--    UPDATE adm_clients
--    SET sync_status = 'synced', last_synced_at = now()
--    WHERE slug = '{client_slug}';
-- =============================================================================
