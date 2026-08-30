-- Rollback for 20260702140000_kiwify_reconcile_cron.sql (KFY-1.6).
-- Unschedules the kiwify_reconcile pg_cron job. No schema changes to revert.

BEGIN;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'kiwify_reconcile';

COMMIT;
