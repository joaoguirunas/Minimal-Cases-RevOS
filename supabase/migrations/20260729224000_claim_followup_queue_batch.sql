BEGIN;

CREATE OR REPLACE FUNCTION public.claim_followup_queue_batch(p_limit integer DEFAULT 50)
RETURNS SETOF public.followup_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.followup_queue fq
  SET status = 'processing', updated_at = now()
  FROM (
    SELECT id FROM public.followup_queue
    WHERE status = 'pending' AND scheduled_for <= now()
    ORDER BY scheduled_for
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) claimed
  WHERE fq.id = claimed.id
  RETURNING fq.*;
END;
$$;

COMMENT ON FUNCTION public.claim_followup_queue_batch IS
  'Atomically claims up to p_limit pending+due followup_queue rows by flipping them to processing (FOR UPDATE SKIP LOCKED), so concurrent invocations of followup-trigger-worker never process the same entry twice.';

-- smoke test: claim 0 rows is safe when nothing pending, confirm function is callable
SELECT count(*) AS claimed_now FROM public.claim_followup_queue_batch(0);

COMMIT;
