-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: handle_meeting_followup_queue() references 'leads_id' but column was
-- renamed to 'lead_id' in P6 FK consistency migration (20260227140000).
-- Error: column "leads_id" of relation "meeting_followup_queue" does not exist
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
  v_scheduled timestamptz;
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
  -- Now accepts rules with webhook_url OR whatsapp_template_id
  FOR rule_rec IN
    SELECT id, channel, webhook_url, message, days, hours, minutes, whatsapp_template_id
      FROM public.meetings_followups
     WHERE active = true
       AND meeting_status = v_status
       AND (
         (webhook_url IS NOT NULL AND webhook_url <> '')
         OR whatsapp_template_id IS NOT NULL
       )
  LOOP
    delay_secs := (
      COALESCE(rule_rec.days, 0)    * 86400 +
      COALESCE(rule_rec.hours, 0)   * 3600  +
      COALESCE(rule_rec.minutes, 0) * 60
    )::bigint;

    -- For 'agendado' status: schedule BEFORE the meeting (start_time - delay)
    -- For all other statuses: schedule AFTER now (now + delay)
    IF v_status = 'agendado' AND NEW.start_time IS NOT NULL THEN
      v_scheduled := NEW.start_time - (delay_secs * interval '1 second');
      -- If the calculated time is in the past, schedule immediately
      IF v_scheduled < now() THEN
        v_scheduled := now();
      END IF;
    ELSE
      v_scheduled := now() + (delay_secs * interval '1 second');
    END IF;

    INSERT INTO public.meeting_followup_queue (
      rule_id, meeting_id, people_id, lead_id,
      scheduled_for, channel, webhook_url, message_snapshot, template_id
    ) VALUES (
      rule_rec.id,
      NEW.id,
      NEW.people_id,
      NEW.lead_id,
      v_scheduled,
      rule_rec.channel,
      rule_rec.webhook_url,
      rule_rec.message,
      rule_rec.whatsapp_template_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;
