-- US-CFG-05: user_notification_preferences table + enum

CREATE TYPE public.notification_event_type AS ENUM (
  'lead_assigned',
  'followup_due',
  'meeting_scheduled',
  'coach_evaluation_ready',
  'transcript_ready',
  'word_spotting_triggered'
);

CREATE TYPE public.notification_channel AS ENUM (
  'in_app',
  'email',
  'whatsapp'
);

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id           uuid                         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid                         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type   public.notification_event_type NOT NULL,
  channel      public.notification_channel  NOT NULL,
  enabled      boolean                      NOT NULL DEFAULT true,
  snoozed_until timestamptz,
  updated_at   timestamptz                  NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type, channel)
);

CREATE INDEX IF NOT EXISTS idx_notif_pref_user_id ON public.user_notification_preferences(user_id);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own preferences
DROP POLICY IF EXISTS notif_pref_all ON public.user_notification_preferences;
CREATE POLICY notif_pref_all ON public.user_notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
