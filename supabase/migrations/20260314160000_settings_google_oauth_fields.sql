-- CFG-05: Decouple Google Calendar OAuth from bi_settings
-- Adds google_client_id and google_client_secret to settings table
-- so Schedule PRO no longer depends on bi_settings (BI PRO).

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS google_client_id text,
ADD COLUMN IF NOT EXISTS google_client_secret text;

-- Seed from bi_settings if values exist (one-time copy)
UPDATE settings s
SET
  google_client_id = COALESCE(s.google_client_id, b.google_client_id),
  google_client_secret = COALESCE(s.google_client_secret, b.google_client_secret)
FROM bi_settings b
WHERE b.singleton = true
  AND (s.google_client_id IS NULL OR s.google_client_secret IS NULL);
