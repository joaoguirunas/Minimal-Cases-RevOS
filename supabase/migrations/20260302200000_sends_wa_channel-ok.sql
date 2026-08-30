-- =============================================================================
-- SENDS PRO: add wa_channel_id to sends table
-- Direct WhatsApp sending via settings_whatsapp_channels (no N8N required)
-- =============================================================================

ALTER TABLE sends
  ADD COLUMN IF NOT EXISTS wa_channel_id uuid
    REFERENCES settings_whatsapp_channels(id) ON DELETE SET NULL;

COMMENT ON COLUMN sends.wa_channel_id IS 'FK to settings_whatsapp_channels — WhatsApp number used for direct Meta API dispatch';
