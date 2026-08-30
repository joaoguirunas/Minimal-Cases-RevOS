-- LP PRO™ Post-Submit Multi-Channel + OMNI PRO Outbound Webhooks
-- Migration: 20260303200000

-- ── 1. Add source_type to messages ────────────────────────────────────────────
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS source_type text
    CHECK (source_type IN ('manual', 'followup', 'appointment_reminder', 'campaign', 'form'));

COMMENT ON COLUMN messages.source_type IS 'Origin of message: manual (default/NULL), followup, appointment_reminder, campaign, form';

CREATE INDEX IF NOT EXISTS idx_messages_source_type ON messages(source_type)
  WHERE source_type IS NOT NULL;

-- ── 2. Create omni_outbound_webhooks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS omni_outbound_webhooks (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text NOT NULL,
  channel         text NOT NULL CHECK (channel IN ('email', 'sms')),
  url             text NOT NULL,
  method          text DEFAULT 'POST' CHECK (method IN ('POST', 'PUT')),
  headers         jsonb DEFAULT '{}',
  payload_template text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE omni_outbound_webhooks IS 'OMNI PRO outbound webhooks for email/SMS delivery (non-WhatsApp channels)';

-- RLS
ALTER TABLE omni_outbound_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "omni_outbound_webhooks_auth_users"
  ON omni_outbound_webhooks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_omni_outbound_webhooks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_omni_outbound_webhooks_updated_at
  BEFORE UPDATE ON omni_outbound_webhooks
  FOR EACH ROW EXECUTE FUNCTION set_omni_outbound_webhooks_updated_at();
