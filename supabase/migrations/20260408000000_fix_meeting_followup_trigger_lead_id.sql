-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: handle_meeting_followup_queue trigger referenced leads_id instead of lead_id
-- Bug: 'new has no field leads_id' when scheduling meetings
-- ══════════════════════════════════════════════════════════════════════════════

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

  -- Normalize meetings.status → meetings_followups.meeting_status
  v_status := CASE NEW.status
    WHEN 'agendada'       THEN 'agendado'
    WHEN 'compareceu'     THEN 'compareceu'
    WHEN 'nao_compareceu' THEN 'nao_compareceu'
    WHEN 'cancelado'      THEN 'cancelado'
    WHEN 'realizado'      THEN 'realizado'
    ELSE NEW.status
  END;

  -- Cancel existing pending queue entries for this meeting (status changed)
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.meeting_followup_queue
       SET status = 'cancelled'
     WHERE meeting_id = NEW.id
       AND status = 'pending';
  END IF;

  -- Create queue entry for each active rule matching the new status
  FOR rule_rec IN
    SELECT id, channel, webhook_url, message, days, hours, minutes
      FROM public.meetings_followups
     WHERE active = true
       AND meeting_status = v_status
       AND webhook_url IS NOT NULL
       AND webhook_url <> ''
  LOOP
    delay_secs := (
      COALESCE(rule_rec.days, 0)    * 86400 +
      COALESCE(rule_rec.hours, 0)   * 3600  +
      COALESCE(rule_rec.minutes, 0) * 60
    )::bigint;

    INSERT INTO public.meeting_followup_queue (
      rule_id, meeting_id, people_id, lead_id,
      scheduled_for, channel, webhook_url, message_snapshot
    ) VALUES (
      rule_rec.id,
      NEW.id,
      NEW.people_id,
      NEW.lead_id,
      now() + (delay_secs * interval '1 second'),
      rule_rec.channel,
      rule_rec.webhook_url,
      rule_rec.message
    );
  END LOOP;

  RETURN NEW;
END;
$$;
