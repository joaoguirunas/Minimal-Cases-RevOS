-- Schedule PRO™ — pg_cron: Google Calendar sync every 15 minutes

-- Enable extensions (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Remove old job if exists (safe to re-run)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'google-calendar-sync';

-- Schedule sync every 15 minutes
SELECT cron.schedule(
  'google-calendar-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ohzwetkaazgxafubzvop.supabase.co/functions/v1/google-cal-sync-to-db',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_WITH_SERVICE_ROLE_JWT_FROM_VAULT'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
