-- ══════════════════════════════════════════════════════════════════════════════
-- FIX: Meeting followup trigger — resolve people_id from attendee_emails
--
-- Root cause: GCal-synced meetings have people_id=NULL and lead_id=NULL.
-- The trigger created queue entries with no contact, causing 100% failure.
--
-- This migration adds a third resolution path: match attendee_emails against
-- clients_people.email to find the contact.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_meeting_followup_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status     text;
  v_people_id  uuid;
  rule_rec     record;
  delay_secs   bigint;
  v_scheduled  timestamptz;
BEGIN
  -- Skip if status didn't change on UPDATE
  IF (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Normalize meetings.status → meetings_followups.meeting_status
  v_status := CASE NEW.status
    WHEN 'agendada'       THEN 'agendado'
    WHEN 'agendado'       THEN 'agendado'
    WHEN 'compareceu'     THEN 'compareceu'
    WHEN 'nao_compareceu' THEN 'nao_compareceu'
    WHEN 'cancelado'      THEN 'cancelado'
    WHEN 'cancelada'      THEN 'cancelado'
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

  -- Resolve people_id: direct → from lead → from attendee_emails
  v_people_id := NEW.people_id;

  IF v_people_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT people_id INTO v_people_id
      FROM public.leads
     WHERE id = NEW.lead_id;
  END IF;

  -- Fallback: match attendee_emails against clients_people.email
  IF v_people_id IS NULL
     AND NEW.attendee_emails IS NOT NULL
     AND array_length(NEW.attendee_emails, 1) > 0
  THEN
    SELECT cp.id INTO v_people_id
      FROM public.clients_people cp
     WHERE cp.email = ANY(NEW.attendee_emails)
     LIMIT 1;

    -- Backfill meeting.people_id for future lookups (best-effort)
    IF v_people_id IS NOT NULL THEN
      UPDATE public.meetings SET people_id = v_people_id WHERE id = NEW.id;
    END IF;
  END IF;

  -- Create queue entry for each active rule matching the new status
  FOR rule_rec IN
    SELECT id, channel, webhook_url, message, days, hours, minutes,
           whatsapp_template_id, as_queue_id
      FROM public.meetings_followups
     WHERE active = true
       AND meeting_status = v_status
       AND (
         (webhook_url IS NOT NULL AND webhook_url <> '')
         OR whatsapp_template_id IS NOT NULL
         OR as_queue_id IS NOT NULL
       )
  LOOP
    delay_secs := (
      COALESCE(rule_rec.days, 0)    * 86400 +
      COALESCE(rule_rec.hours, 0)   * 3600  +
      COALESCE(rule_rec.minutes, 0) * 60
    )::bigint;

    -- For 'agendado' status: schedule BEFORE the meeting (start_time - delay)
    IF v_status = 'agendado' AND NEW.start_time IS NOT NULL THEN
      v_scheduled := NEW.start_time - (delay_secs * interval '1 second');
      IF v_scheduled < now() THEN
        v_scheduled := now();
      END IF;
    ELSE
      v_scheduled := now() + (delay_secs * interval '1 second');
    END IF;

    INSERT INTO public.meeting_followup_queue (
      rule_id, meeting_id, people_id, lead_id,
      scheduled_for, channel, webhook_url, message_snapshot,
      template_id, as_queue_id
    ) VALUES (
      rule_rec.id,
      NEW.id,
      v_people_id,
      NEW.lead_id,
      v_scheduled,
      rule_rec.channel,
      rule_rec.webhook_url,
      rule_rec.message,
      rule_rec.whatsapp_template_id,
      rule_rec.as_queue_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS trg_meeting_followup_queue ON public.meetings;
CREATE TRIGGER trg_meeting_followup_queue
  AFTER INSERT OR UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_meeting_followup_queue();
