-- Rollback: FWUP-06 followup retry worker cron

BEGIN;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'followup-retry-worker';

DROP FUNCTION IF EXISTS public.trigger_followup_retry_worker();

DROP INDEX IF EXISTS public.idx_fup_queue_retry;
DROP INDEX IF EXISTS public.idx_mfq_retry;

ALTER TABLE public.meeting_followup_queue
  DROP COLUMN IF EXISTS retry_count;

COMMIT;
