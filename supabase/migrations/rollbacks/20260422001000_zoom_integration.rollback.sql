-- Zoom Integration — ROLLBACK
-- Reverts 20260422001000_zoom_integration.sql

BEGIN;

-- ── 3. bi_settings ────────────────────────────────────────────────────────────

ALTER TABLE public.bi_settings
  DROP COLUMN IF EXISTS zoom_client_id,
  DROP COLUMN IF EXISTS zoom_client_secret,
  DROP COLUMN IF EXISTS zoom_account_id;

-- ── 2. meetings ───────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS meetings_zoom_meeting_id_idx;

ALTER TABLE public.meetings
  DROP COLUMN IF EXISTS zoom_meeting_id,
  DROP COLUMN IF EXISTS zoom_join_url,
  DROP COLUMN IF EXISTS zoom_sync_error;

-- ── 1. user_calendar_connections ─────────────────────────────────────────────

ALTER TABLE public.user_calendar_connections
  DROP COLUMN IF EXISTS zoom_access_token,
  DROP COLUMN IF EXISTS zoom_refresh_token,
  DROP COLUMN IF EXISTS zoom_token_expires_at,
  DROP COLUMN IF EXISTS zoom_user_id,
  DROP COLUMN IF EXISTS zoom_account_id,
  DROP COLUMN IF EXISTS zoom_email;

ALTER TABLE public.user_calendar_connections
  DROP CONSTRAINT IF EXISTS user_calendar_connections_provider_check;

ALTER TABLE public.user_calendar_connections
  ADD CONSTRAINT user_calendar_connections_provider_check
  CHECK (provider IN ('google', 'microsoft'));

-- Note: google_email NOT NULL is NOT restored.
-- Restoring it would fail if any rows with provider='microsoft' have google_email=NULL.
-- To restore manually: ALTER TABLE public.user_calendar_connections ALTER COLUMN google_email SET NOT NULL;
-- Only safe if you first verify: SELECT COUNT(*) FROM public.user_calendar_connections WHERE google_email IS NULL;

COMMIT;
