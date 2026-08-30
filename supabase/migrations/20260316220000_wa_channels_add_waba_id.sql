-- WAT-01: Add waba_id to settings_whatsapp_channels
-- Required for Meta Template Management API (operates at WABA level, not phone number)
ALTER TABLE settings_whatsapp_channels
  ADD COLUMN IF NOT EXISTS waba_id TEXT;

COMMENT ON COLUMN settings_whatsapp_channels.waba_id IS 'WhatsApp Business Account ID — required for template management via Meta Graph API';
