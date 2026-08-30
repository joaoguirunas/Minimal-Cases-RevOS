-- =============================================================================
-- N8N-WAA-2: settings_ai_providers — global LLM API key store
-- Epic: Native AI Agent Runtime (N8N-WAA)
-- Agent: @data-engineer
--
-- SECURITY NOTE: api_key is stored as plaintext here.
-- For production, encrypt via pgsodium:
--   UPDATE settings_ai_providers SET api_key = pgsodium.crypto_aead_det_encrypt(
--     api_key::bytea, additional::bytea, key_id
--   )
-- Edge functions use service_role to read and decrypt at runtime.
-- The api_key column is NEVER returned to the frontend (RLS SELECT excludes it).
-- =============================================================================

CREATE TABLE IF NOT EXISTS settings_ai_providers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text        NOT NULL,
  label       text        NOT NULL,
  api_key     text        NOT NULL,
  is_default  boolean     NOT NULL DEFAULT false,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT settings_ai_providers_provider_check
    CHECK (provider IN ('openai', 'anthropic', 'groq', 'gemini'))
);

-- Only one default per provider
CREATE UNIQUE INDEX IF NOT EXISTS settings_ai_providers_one_default_per_provider
  ON settings_ai_providers (provider)
  WHERE is_default = true AND active = true;

-- Documentation
COMMENT ON TABLE settings_ai_providers IS 'Global LLM API keys. api_key never exposed to frontend — service_role only.';
COMMENT ON COLUMN settings_ai_providers.provider   IS 'Provider: openai | anthropic | groq | gemini';
COMMENT ON COLUMN settings_ai_providers.label      IS 'Human-readable label (e.g. "OpenAI Produção")';
COMMENT ON COLUMN settings_ai_providers.api_key    IS 'Raw API key — service_role read only, never SELECT via RLS';
COMMENT ON COLUMN settings_ai_providers.is_default IS 'Fallback provider when ai_agents.llm_provider_id is null';

-- updated_at trigger
CREATE OR REPLACE FUNCTION settings_ai_providers_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER settings_ai_providers_updated_at
  BEFORE UPDATE ON settings_ai_providers
  FOR EACH ROW EXECUTE FUNCTION settings_ai_providers_set_updated_at();

-- RLS: frontend sees label/provider/is_default/active but NOT api_key
ALTER TABLE settings_ai_providers ENABLE ROW LEVEL SECURITY;

-- Gestor/admin: full metadata view (api_key excluded via application layer)
CREATE POLICY "ai_providers_select_admin"
  ON settings_ai_providers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "ai_providers_insert_admin"
  ON settings_ai_providers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "ai_providers_update_admin"
  ON settings_ai_providers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "ai_providers_delete_admin"
  ON settings_ai_providers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- FK from ai_agents (migration 1 created the column, now add constraint)
ALTER TABLE ai_agents
  ADD CONSTRAINT ai_agents_llm_provider_id_fkey
    FOREIGN KEY (llm_provider_id)
    REFERENCES settings_ai_providers(id)
    ON DELETE SET NULL;
