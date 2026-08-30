-- Schedule PRO™ — Google Calendar ↔ DB Bidirectional Sync
-- Phase: DB Schema additions for sync

-- 1. Track when each meeting was last synced from Google
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS google_last_synced_at timestamptz;

-- 2. Unique index on google_event_id (required for upsert ON CONFLICT)
--    Partial: only applies to non-null values so app meetings without
--    a google_event_id don't conflict with each other.
CREATE UNIQUE INDEX IF NOT EXISTS meetings_google_event_id_idx
  ON public.meetings(google_event_id)
  WHERE google_event_id IS NOT NULL;

-- NOTE: After deploying the google-cal-sync-to-db edge function,
-- set up the 15-minute cron job by running the following in the
-- Supabase SQL editor (Project → SQL Editor):
--
--   SELECT cron.schedule(
--     'google-calendar-sync',
--     '*/15 * * * *',
--     $$
--     SELECT net.http_post(
--       url := 'https://ohzwetkaazgxafubzvop.supabase.co/functions/v1/google-cal-sync-to-db',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || (
--           SELECT decrypted_secret FROM vault.decrypted_secrets
--           WHERE name = 'supabase_service_role' LIMIT 1
--         )
--       ),
--       body := '{}'::jsonb
--     ) AS request_id;
--     $$
--   );
--
-- Before running the above, store your service role key in vault once:
--   SELECT vault.create_secret('PASTE_SERVICE_ROLE_KEY_HERE', 'supabase_service_role');
-- (Find it in: Supabase Dashboard → Project Settings → API → service_role key)
