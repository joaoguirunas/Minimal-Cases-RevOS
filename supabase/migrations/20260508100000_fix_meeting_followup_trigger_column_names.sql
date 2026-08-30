-- Fix: handle_meeting_followup_queue trigger uses stale column names after post-FWUP renames.
--
-- After FWUP-11b (20260427100000): meeting_followup_queue.people_id  → person_id
-- After FWUP-12  (20260428010000): meeting_followup_queue.leads_id   → lead_id
--                                   meetings.leads_id                 → lead_id
--
-- The trigger from 20260427110000 still referenced leads_id (target column) and
-- NEW.leads_id (source from meetings), causing the trigger to fail at INSERT time.
-- PostgREST surfaces this as an RLS violation on meeting_followup_queue.
--
-- This migration:
--   1. Recreates the function with correct column names + SECURITY DEFINER
--   2. Adds an INSERT RLS policy for authenticated users as belt-and-suspenders

-- ── 1. Fix trigger function ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_meeting_followup_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status    text;
  rule_rec    record;
  delay_secs  bigint;
BEGIN
  -- Skip if status didn't change on UPDATE
  IF (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Normalize meetings.status → canonical value
  v_status := CASE NEW.status
    WHEN 'agendada'         THEN 'agendado'
    WHEN 'agendado'         THEN 'agendado'
    WHEN 'compareceu'       THEN 'compareceu'
    WHEN 'nao_compareceu'   THEN 'nao_compareceu'
    WHEN 'não compareceu'   THEN 'nao_compareceu'
    WHEN 'cancelado'        THEN 'cancelado'
    WHEN 'cancelada'        THEN 'cancelado'
    WHEN 'realizado'        THEN 'realizado'
    ELSE NULL
  END;

  -- Unknown status — skip
  IF v_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cancel pending entries for this meeting on status change
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.meeting_followup_queue
       SET status = 'cancelled'
     WHERE meeting_id = NEW.id
       AND status = 'pending';
  END IF;

  -- Enqueue one entry per active rule matching the canonical status
  FOR rule_rec IN
    SELECT id, channel, webhook_url, message, days, hours, minutes
      FROM public.meetings_followups
     WHERE active = true
       AND meeting_status = v_status
  LOOP
    delay_secs := (
      COALESCE(rule_rec.days, 0)    * 86400 +
      COALESCE(rule_rec.hours, 0)   * 3600  +
      COALESCE(rule_rec.minutes, 0) * 60
    )::bigint;

    INSERT INTO public.meeting_followup_queue (
      rule_id, meeting_id, person_id, lead_id,
      scheduled_for, channel, webhook_url, message_snapshot
    ) VALUES (
      rule_rec.id,
      NEW.id,
      NEW.people_id,
      NEW.lead_id,
      now() + (delay_secs * interval '1 second'),
      rule_rec.channel,
      COALESCE(rule_rec.webhook_url, ''),
      rule_rec.message
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_meeting_followup_queue() IS
  'Trigger: enqueues followup rules when meeting.status changes. '
  'Column names fixed post-FWUP-11b (person_id) and post-FWUP-12 (lead_id). '
  'SECURITY DEFINER bypasses RLS for the INSERT into meeting_followup_queue.';

-- ── 2. Ensure trigger is attached (idempotent) ────────────────────────────────

DROP TRIGGER IF EXISTS trg_meeting_followup_queue ON public.meetings;

CREATE TRIGGER trg_meeting_followup_queue
  AFTER INSERT OR UPDATE OF status
  ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_meeting_followup_queue();

-- ── 3. INSERT policy as belt-and-suspenders ───────────────────────────────────
-- Allows authenticated users to insert into meeting_followup_queue.
-- In normal operation the SECURITY DEFINER trigger handles all inserts.
-- This policy is a fallback so the queue still works if the trigger
-- ever runs in a non-SECURITY DEFINER context.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'meeting_followup_queue'
      AND policyname = 'mfq_insert'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY mfq_insert ON public.meeting_followup_queue
        FOR INSERT
        TO authenticated
        WITH CHECK (true)
    $pol$;
  END IF;
END $$;
