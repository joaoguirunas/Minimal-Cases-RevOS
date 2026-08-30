-- SCH-H-3: Move service-role JWT from cron migrations to Vault — ADR-SP-05
--
-- PREREQUISITE (manual — must be done BEFORE applying this migration):
--   1. In Supabase Dashboard → Settings → API → Reset service_role key
--   2. In Supabase Dashboard → Vault → Add secret:
--        name: service_role_cron
--        value: <new service_role JWT>
--
-- WHAT THIS MIGRATION DOES:
--   Re-registers both pg_cron jobs that contained hardcoded JWTs
--   (20260226301000:207 and 20260219140000:21) to use secure_http_post()
--   which reads the secret from Vault at runtime — never hardcoded.
--
-- If Vault secret 'service_role_cron' is absent, cron jobs fail-closed
-- (RAISE EXCEPTION from secure_http_post). This is the intended behaviour.
--
-- NOTE: Old migration files are NOT modified — they are git history.
-- The leaked JWT is invalidated by rotation (step 1 above), not by code.

BEGIN;

-- ── 1. Re-register process-meeting-followups (every 5 min) ──────────────────

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-meeting-followups';

SELECT cron.schedule(
  'process-meeting-followups',
  '*/5 * * * *',
  $$
  SELECT public.secure_http_post(
    'service_role_cron',
    'https://ohzwetkaazgxafubzvop.supabase.co/functions/v1/process-meeting-followups',
    '{}'::jsonb,
    'process-meeting-followups-cron'
  );
  $$
);

-- ── 2. Re-register google-calendar-sync (every 15 min) ──────────────────────

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'google-calendar-sync';

SELECT cron.schedule(
  'google-calendar-sync',
  '*/15 * * * *',
  $$
  SELECT public.secure_http_post(
    'service_role_cron',
    'https://ohzwetkaazgxafubzvop.supabase.co/functions/v1/google-cal-sync-to-db',
    '{}'::jsonb,
    'google-calendar-sync-cron'
  );
  $$
);

COMMIT;
