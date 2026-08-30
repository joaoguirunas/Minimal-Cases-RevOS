-- =============================================================================
-- ElevenLabs Infrastructure Tables
-- Epic: EPIC-ELEVENLABS-INFRA / Story: EL-01
-- Agent: @data-engineer (Dara) → executed by @dev (Dex)
--
-- Creates 3 tables + extends ai_agents for voice infrastructure.
-- Follows patterns from: settings_ai_providers, bi_settings, crm_llm_connections
-- =============================================================================

-- ─── 1. settings_elevenlabs (singleton) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.settings_elevenlabs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key               text,                                    -- plaintext for service_role reads (edge functions)
  api_key_encrypted     text,                                    -- pgcrypto encrypted for storage safety
  workspace_id          text,
  default_model_id      text        DEFAULT 'eleven_flash_v2_5', -- Flash v2.5: lowest latency, 50% cheaper
  default_voice_id      text,
  default_output_format text        DEFAULT 'mp3_44100_128',
  webhook_secret        text,
  monthly_char_limit    integer     DEFAULT 100000,
  monthly_char_used     integer     DEFAULT 0,
  monthly_reset_at      timestamptz,
  active                boolean     DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Singleton: only one row allowed
CREATE UNIQUE INDEX IF NOT EXISTS settings_elevenlabs_singleton
  ON public.settings_elevenlabs ((true));

COMMENT ON TABLE public.settings_elevenlabs IS 'ElevenLabs: Singleton — API key, TTS model, voice defaults, webhook, usage tracking';

-- ─── 2. elevenlabs_voices (voice catalog cache) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.elevenlabs_voices (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_id          text        NOT NULL,
  name              text        NOT NULL,
  category          text,                                        -- premade, cloned, generated, professional
  language          text,                                        -- pt-BR, en-US, etc.
  description       text,
  stability         numeric(4,3) DEFAULT 0.500,
  similarity_boost  numeric(4,3) DEFAULT 0.750,
  style             numeric(4,3) DEFAULT 0.000,
  speed             numeric(4,3) DEFAULT 1.000,
  preview_url       text,
  is_default        boolean     DEFAULT false,
  synced_at         timestamptz DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT elevenlabs_voices_voice_id_unique UNIQUE (voice_id)
);

COMMENT ON TABLE public.elevenlabs_voices IS 'ElevenLabs: Cached voice catalog synced from workspace API';

-- ─── 3. elevenlabs_agents (conversational AI agents) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.elevenlabs_agents (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  elevenlabs_agent_id   text        NOT NULL,
  name                  text,
  voice_id              text,
  llm_provider          text,
  llm_model             text,
  phone_number_id       text,
  phone_number          text,                                    -- display: +55 11 9999-9999
  first_message         text,
  status                text        DEFAULT 'active',
  ai_agent_id           uuid        REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  synced_at             timestamptz DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT elevenlabs_agents_agent_id_unique UNIQUE (elevenlabs_agent_id)
);

COMMENT ON TABLE public.elevenlabs_agents IS 'ElevenLabs: Conversational AI agents linked to CRM ai_agents';

-- ─── 4. Extend ai_agents ────────────────────────────────────────────────────

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS elevenlabs_agent_id uuid REFERENCES public.elevenlabs_agents(id) ON DELETE SET NULL;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS voice_enabled boolean DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS voice_id text;

-- ─── 5. Encryption functions (pgcrypto — same pattern as crm_llm_connections) ─

CREATE OR REPLACE FUNCTION public.encrypt_elevenlabs_key(key_value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF key_value IS NULL OR key_value = '' THEN RETURN NULL; END IF;
  RETURN encode(pgp_sym_encrypt(key_value, 'elevenlabs_gs_2026'), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_elevenlabs_key(encrypted_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF encrypted_key IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(decode(encrypted_key, 'base64'), 'elevenlabs_gs_2026');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ─── 6. RLS Policies ────────────────────────────────────────────────────────
-- Pattern from settings_ai_providers: gestor/super_admin via settings_users

ALTER TABLE public.settings_elevenlabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elevenlabs_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elevenlabs_agents ENABLE ROW LEVEL SECURITY;

-- settings_elevenlabs
DROP POLICY IF EXISTS "settings_elevenlabs_select" ON public.settings_elevenlabs;
CREATE POLICY "settings_elevenlabs_select" ON public.settings_elevenlabs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM settings_users WHERE auth_user_id = auth.uid() AND (super_admin = true OR user_type = 'gestor') AND active = true AND deleted_at IS NULL)
  );
DROP POLICY IF EXISTS "settings_elevenlabs_insert" ON public.settings_elevenlabs;
CREATE POLICY "settings_elevenlabs_insert" ON public.settings_elevenlabs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM settings_users WHERE auth_user_id = auth.uid() AND (super_admin = true OR user_type = 'gestor') AND active = true AND deleted_at IS NULL)
  );
DROP POLICY IF EXISTS "settings_elevenlabs_update" ON public.settings_elevenlabs;
CREATE POLICY "settings_elevenlabs_update" ON public.settings_elevenlabs
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM settings_users WHERE auth_user_id = auth.uid() AND (super_admin = true OR user_type = 'gestor') AND active = true AND deleted_at IS NULL)
  );
DROP POLICY IF EXISTS "settings_elevenlabs_delete" ON public.settings_elevenlabs;
CREATE POLICY "settings_elevenlabs_delete" ON public.settings_elevenlabs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM settings_users WHERE auth_user_id = auth.uid() AND (super_admin = true OR user_type = 'gestor') AND active = true AND deleted_at IS NULL)
  );

-- elevenlabs_voices — same pattern
DROP POLICY IF EXISTS "elevenlabs_voices_all" ON public.elevenlabs_voices;
CREATE POLICY "elevenlabs_voices_all" ON public.elevenlabs_voices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- elevenlabs_agents — gestor only
DROP POLICY IF EXISTS "elevenlabs_agents_select" ON public.elevenlabs_agents;
CREATE POLICY "elevenlabs_agents_select" ON public.elevenlabs_agents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM settings_users WHERE auth_user_id = auth.uid() AND (super_admin = true OR user_type = 'gestor') AND active = true AND deleted_at IS NULL)
  );
DROP POLICY IF EXISTS "elevenlabs_agents_insert" ON public.elevenlabs_agents;
CREATE POLICY "elevenlabs_agents_insert" ON public.elevenlabs_agents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM settings_users WHERE auth_user_id = auth.uid() AND (super_admin = true OR user_type = 'gestor') AND active = true AND deleted_at IS NULL)
  );
DROP POLICY IF EXISTS "elevenlabs_agents_update" ON public.elevenlabs_agents;
CREATE POLICY "elevenlabs_agents_update" ON public.elevenlabs_agents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM settings_users WHERE auth_user_id = auth.uid() AND (super_admin = true OR user_type = 'gestor') AND active = true AND deleted_at IS NULL)
  );
DROP POLICY IF EXISTS "elevenlabs_agents_delete" ON public.elevenlabs_agents;
CREATE POLICY "elevenlabs_agents_delete" ON public.elevenlabs_agents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM settings_users WHERE auth_user_id = auth.uid() AND (super_admin = true OR user_type = 'gestor') AND active = true AND deleted_at IS NULL)
  );

-- ─── 7. updated_at triggers ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_elevenlabs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_settings_elevenlabs_updated_at
  BEFORE UPDATE ON public.settings_elevenlabs
  FOR EACH ROW EXECUTE FUNCTION public.set_elevenlabs_updated_at();

CREATE TRIGGER set_elevenlabs_voices_updated_at
  BEFORE UPDATE ON public.elevenlabs_voices
  FOR EACH ROW EXECUTE FUNCTION public.set_elevenlabs_updated_at();

CREATE TRIGGER set_elevenlabs_agents_updated_at
  BEFORE UPDATE ON public.elevenlabs_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_elevenlabs_updated_at();
