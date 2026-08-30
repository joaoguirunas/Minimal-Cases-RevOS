-- Add as_dialer_token to call_pro_settings
-- Used for direct outbound calls via https://dialer.atendesimples.com (replaces N8N webhook)

ALTER TABLE call_pro_settings
  ADD COLUMN IF NOT EXISTS as_dialer_token TEXT;
