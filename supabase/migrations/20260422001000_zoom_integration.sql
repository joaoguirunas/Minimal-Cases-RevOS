-- Zoom Integration — Schedule PRO™
-- Per-user Zoom OAuth tokens + meeting sync
-- App-level Zoom credentials in bi_settings
-- Follows same pattern as google_calendar (20260218143000) and ms_teams (20260219220000)

BEGIN;

-- ── 1. user_calendar_connections ─────────────────────────────────────────────

-- Make google_email nullable (was NOT NULL, but only applies to Google provider)
ALTER TABLE public.user_calendar_connections
  ALTER COLUMN google_email DROP NOT NULL;

-- Extend provider CHECK constraint to include 'zoom'
ALTER TABLE public.user_calendar_connections
  DROP CONSTRAINT IF EXISTS user_calendar_connections_provider_check;

ALTER TABLE public.user_calendar_connections
  ADD CONSTRAINT user_calendar_connections_provider_check
  CHECK (provider IN ('google', 'microsoft', 'zoom'));

-- Add Zoom OAuth token fields (per-user)
ALTER TABLE public.user_calendar_connections
  ADD COLUMN IF NOT EXISTS zoom_access_token     text,
  ADD COLUMN IF NOT EXISTS zoom_refresh_token    text,
  ADD COLUMN IF NOT EXISTS zoom_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS zoom_user_id          text,
  ADD COLUMN IF NOT EXISTS zoom_account_id       text,
  ADD COLUMN IF NOT EXISTS zoom_email            text;

-- ── 2. meetings ───────────────────────────────────────────────────────────────

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS zoom_meeting_id  text,
  ADD COLUMN IF NOT EXISTS zoom_join_url    text,
  ADD COLUMN IF NOT EXISTS zoom_sync_error  text;

CREATE UNIQUE INDEX IF NOT EXISTS meetings_zoom_meeting_id_idx
  ON public.meetings (zoom_meeting_id)
  WHERE zoom_meeting_id IS NOT NULL;

-- ── 3. bi_settings — app-level Zoom OAuth credentials ────────────────────────

ALTER TABLE public.bi_settings
  ADD COLUMN IF NOT EXISTS zoom_client_id     text,
  ADD COLUMN IF NOT EXISTS zoom_client_secret text,  -- Server-only, never sent to client
  ADD COLUMN IF NOT EXISTS zoom_account_id    text;  -- Server-to-Server OAuth account ID

COMMIT;
