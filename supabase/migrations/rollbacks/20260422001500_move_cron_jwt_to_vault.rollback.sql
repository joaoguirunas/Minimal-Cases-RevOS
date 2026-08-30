-- SCH-H-3 rollback — re-register cron jobs with Vault lookup (NOT re-hardcoded JWT)
-- Rollback intentionally fails if 'service_role_cron' secret is absent.
-- If you are rolling back because the Vault secret is wrong, fix the secret first.

BEGIN;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('process-meeting-followups', 'google-calendar-sync');

SELECT cron.schedule(
  'process-meeting-followups',
  '*/5 * * * *',
  $$
  SELECT public.secure_http_post(
    'service_role_cron',
    'https://ohzwetkaazgxafubzvop.supabase.co/functions/v1/process-meeting-followups',
    '{}'::jsonb,
    'process-meeting-followups-cron-rollback'
  );
  $$
);

SELECT cron.schedule(
  'google-calendar-sync',
  '*/15 * * * *',
  $$
  SELECT public.secure_http_post(
    'service_role_cron',
    'https://ohzwetkaazgxafubzvop.supabase.co/functions/v1/google-cal-sync-to-db',
    '{}'::jsonb,
    'google-calendar-sync-cron-rollback'
  );
  $$
);

COMMIT;
