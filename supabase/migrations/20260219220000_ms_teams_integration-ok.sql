-- Microsoft Teams Integration — Schedule PRO™
-- Extends calendar connections to support Google OR Microsoft (mutually exclusive)
-- Adds Teams meeting ID to meetings table
-- Adds Azure app credentials to bi_settings

-- 1. Extend user_calendar_connections with provider + Microsoft columns
ALTER TABLE public.user_calendar_connections
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'google'
    CHECK (provider IN ('google', 'microsoft')),
  ADD COLUMN IF NOT EXISTS ms_access_token text,
  ADD COLUMN IF NOT EXISTS ms_refresh_token text,
  ADD COLUMN IF NOT EXISTS ms_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS ms_user_id text,
  ADD COLUMN IF NOT EXISTS ms_email text;

-- 2. Add Teams meeting ID to meetings
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS ms_meeting_id text;

CREATE UNIQUE INDEX IF NOT EXISTS meetings_ms_meeting_id_idx
  ON public.meetings (ms_meeting_id)
  WHERE ms_meeting_id IS NOT NULL;

-- 3. Add Azure app credentials to bi_settings
ALTER TABLE public.bi_settings
  ADD COLUMN IF NOT EXISTS ms_client_id text,
  ADD COLUMN IF NOT EXISTS ms_client_secret text;  -- Server-only, never sent to client
