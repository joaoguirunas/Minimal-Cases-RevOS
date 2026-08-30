-- FWUP-06: Followup Queue Retry Worker — pg_cron + meeting_followup_queue retry support
-- Story: FWUP-06
-- Adds:
--   1. retry_count column to meeting_followup_queue (if missing)
--   2. PL/pgSQL trigger function using secure_http_post (ADR-SP-05)
--   3. pg_cron job: followup-retry-worker every 10 minutes
--   4. Rollback companion: 20260427040000_fwup06_followup_retry_worker_cron.rollback.sql

BEGIN;

-- ── 1. Add retry_count to meeting_followup_queue ──────────────────────────────

ALTER TABLE public.meeting_followup_queue
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.meeting_followup_queue.retry_count IS
  'Number of retry attempts after N8N/webhook callback timeout (max 3). FWUP-06.';

-- Index for the retry worker query pattern
CREATE INDEX IF NOT EXISTS idx_mfq_retry
  ON public.meeting_followup_queue (status, scheduled_for, retry_count)
  WHERE status = 'queued';

-- ── 2. Index on followup_queue for retry worker ───────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fup_queue_retry
  ON public.followup_queue (status, updated_at, retry_count)
  WHERE status = 'queued';

-- ── 3. PL/pgSQL trigger function ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trigger_followup_retry_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stale_threshold timestamptz := now() - interval '15 minutes';
BEGIN
  -- Only invoke edge function when there are stale queued entries
  IF NOT EXISTS (
    SELECT 1
    FROM public.followup_queue
    WHERE status = 'queued'
      AND updated_at < v_stale_threshold
      AND retry_count < 3
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM public.secure_http_post(
    'service_role_key',
    current_setting('app.supabase_url', true) || '/functions/v1/followup-retry-worker',
    jsonb_build_object('source', 'pg_cron'),
    'trigger_followup_retry_worker'
  );
END;
$$;

COMMENT ON FUNCTION public.trigger_followup_retry_worker() IS
  'Called by pg_cron every 10 minutes. Invokes followup-retry-worker edge fn only when '
  'there are stale queued entries in followup_queue (status=queued, updated_at older than 15 min). '
  'Uses secure_http_post (ADR-SP-05). FWUP-06.';

-- ── 4. Register pg_cron job ───────────────────────────────────────────────────

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'followup-retry-worker';

SELECT cron.schedule(
  'followup-retry-worker',
  '*/10 * * * *',
  $$ SELECT public.trigger_followup_retry_worker(); $$
);

COMMIT;
