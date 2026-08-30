-- Capability Token GC Cron — ADR-SP-01 / ADR-SP-02
-- Daily garbage collection for JTI denylist tables.
-- Runs at 03:00 UTC. pg_cron executes SQL directly as a privileged role —
-- no HTTP call or JWT required.
--
-- TTLs:
--   booking_token_jti_usage  — 30 days (aligns with ADR-SP-01 token TTL)
--   action_token_consumed    — 24 hours (action tokens are valid for 60s max)

-- Idempotent: cron.schedule replaces an existing job with the same name.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'capability-token-gc';

SELECT cron.schedule(
  'capability-token-gc',
  '0 3 * * *',
  $$
    -- GC booking_token_jti_usage (TTL: 30 days)
    DELETE FROM public.booking_token_jti_usage
    WHERE revoked_at < now() - interval '30 days';

    -- GC action_token_consumed (TTL: 24 hours)
    DELETE FROM public.action_token_consumed
    WHERE consumed_at < now() - interval '24 hours';
  $$
);
