-- =============================================================================
-- N8N-WAA-6: settings_whatsapp_channels — per-channel Meta API credentials
-- =============================================================================
-- Context:
--   The WHATSAPP_ACCESS_TOKEN env var is shared globally across all agents.
--   This table allows multiple WhatsApp Business numbers to be registered,
--   each with its own phone_number_id and access_token.
--
--   ai_agents.wa_channel_id → settings_whatsapp_channels(id)
--
--   whatsapp-outbound edge fn: receives channel_id, looks up credentials here
--   whatsapp-inbound edge fn: still matches agents by wa_phone_number_id (unchanged)
--
--   SENDS / FOLLOWUPS: sends.wa_channel_id column added below for future use.
-- =============================================================================

CREATE TABLE IF NOT EXISTS settings_whatsapp_channels (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label           text        NOT NULL,
  phone_number_id text        NOT NULL UNIQUE,
  access_token    text        NOT NULL,
  is_default      boolean     NOT NULL DEFAULT false,
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Only one default channel
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_channels_one_default
  ON settings_whatsapp_channels (is_default)
  WHERE is_default = true AND active = true;

-- updated_at trigger
CREATE OR REPLACE FUNCTION settings_whatsapp_channels_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER whatsapp_channels_updated_at
  BEFORE UPDATE ON settings_whatsapp_channels
  FOR EACH ROW EXECUTE FUNCTION settings_whatsapp_channels_set_updated_at();

-- RLS
ALTER TABLE settings_whatsapp_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_channels_admin_all"
  ON settings_whatsapp_channels FOR ALL TO authenticated
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());

-- FK on ai_agents: wa_channel_id → channel
ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS wa_channel_id uuid
    REFERENCES settings_whatsapp_channels(id) ON DELETE SET NULL;

COMMENT ON COLUMN ai_agents.wa_channel_id        IS 'FK to settings_whatsapp_channels — which WA number this agent sends from';
COMMENT ON COLUMN settings_whatsapp_channels.phone_number_id IS 'Meta WhatsApp Business phone_number_id';
COMMENT ON COLUMN settings_whatsapp_channels.access_token    IS 'Meta Graph API access token for this number';
