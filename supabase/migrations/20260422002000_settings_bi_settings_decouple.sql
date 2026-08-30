-- FIX-SETTINGS-02: Formalize settings / bi_settings separation
--
-- Decision: keep tables separate. Their responsibilities are distinct:
--   settings     → tenant identity, branding, enrichment API keys (multi-row, ordered)
--   bi_settings  → BI/ads OAuth credentials, singleton row (WHERE singleton = true)
--
-- The only true overlap is google_client_id + google_client_secret.
-- Migration CFG-05 (20260310200000) already seeded settings.google_client_id/secret
-- from bi_settings. All server-side edge functions already read settings first
-- and fall back to bi_settings. This migration removes the duplicate columns
-- from bi_settings so there is a single source of truth.
--
-- Edge functions affected (already have the settings-first pattern):
--   google-cal-connect, google-cal-sync-events, google-cal-upsert-event,
--   google-cal-pull-event, google-cal-availability, google-cal-sync-to-db,
--   public-booking
-- The bi-google-oauth edge function reads google_client_id/secret exclusively
-- from bi_settings — it will be updated separately (FIX-SETTINGS-02 AC4).

BEGIN;

-- Safety: ensure settings.google_client_id is populated before dropping
-- the bi_settings columns. If for any tenant settings is empty, copy now.
UPDATE public.settings s
SET
  google_client_id     = COALESCE(s.google_client_id,     b.google_client_id),
  google_client_secret = COALESCE(s.google_client_secret, b.google_client_secret)
FROM public.bi_settings b
WHERE b.singleton = true
  AND (s.google_client_id IS NULL OR s.google_client_secret IS NULL)
  AND (b.google_client_id IS NOT NULL OR b.google_client_secret IS NOT NULL);

-- Drop redundant columns from bi_settings
ALTER TABLE public.bi_settings
  DROP COLUMN IF EXISTS google_client_id,
  DROP COLUMN IF EXISTS google_client_secret;

-- google_developer_token is BI-only (Google Ads API, not Calendar OAuth).
-- It stays in bi_settings — no change needed.

COMMENT ON TABLE public.bi_settings IS
  'BI PRO™: Singleton row — OAuth credentials for Meta Ads, Google Ads, Microsoft, and Zoom integrations. '
  'Google Calendar OAuth (google_client_id/secret) lives in the settings table.';

COMMIT;
