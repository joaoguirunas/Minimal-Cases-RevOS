-- =============================================================================
-- Add app_secret to settings_whatsapp_channels
-- The Meta App Secret is needed to validate HMAC-SHA256 signatures
-- on incoming webhook POST requests from Meta.
-- =============================================================================

ALTER TABLE settings_whatsapp_channels
  ADD COLUMN IF NOT EXISTS app_secret text;

COMMENT ON COLUMN settings_whatsapp_channels.app_secret
  IS 'Meta App Secret — used to validate x-hub-signature-256 on inbound webhooks';
