-- Google Calendar Integration — Schedule PRO™
-- Per-user Google Calendar OAuth tokens + meeting sync

CREATE TABLE IF NOT EXISTS public.user_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.settings_users(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  google_access_token text,
  google_refresh_token text NOT NULL,
  google_token_expires_at timestamptz,
  google_calendar_id text NOT NULL DEFAULT 'primary',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Track synced Google Calendar events on meetings
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS google_event_id text;

-- RLS
ALTER TABLE public.user_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Users can manage their own connection; super_admin and gestors can read all
DROP POLICY IF EXISTS "calendar_connection_self" ON public.user_calendar_connections;
CREATE POLICY "calendar_connection_self"
  ON public.user_calendar_connections
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users su
      WHERE su.auth_user_id = auth.uid()
        AND (
          su.id = user_calendar_connections.user_id
          OR su.super_admin = true
          OR su.user_type = 'gestor'
        )
        AND su.active = true
    )
  );
