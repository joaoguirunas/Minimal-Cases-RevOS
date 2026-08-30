-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: Meeting Follow-up Queue — webhook_url nullable + channel sync
--
-- Bug 1: meeting_followup_queue.webhook_url is NOT NULL, but template-only
--         rules have no webhook. Trigger INSERT silently fails → queue never
--         populated → follow-ups never fire.
--
-- Bug 2: UI hook writes to `type` column but never sets `channel`. The DB
--         trigger reads `channel` for routing. Existing rules may have wrong
--         channel value (defaulted to 'whatsapp' regardless of actual type).
--
-- Fixes:
--   1. Make webhook_url nullable in queue table
--   2. Backfill channel from type in meetings_followups
--   3. Add 'ligacao' to channel CHECK constraint
--   4. Recreate trigger with robust null handling
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Make webhook_url nullable in meeting_followup_queue ─────────────────

ALTER TABLE public.meeting_followup_queue
  ALTER COLUMN webhook_url DROP NOT NULL;

-- ─── 2. Expand channel CHECK to include 'ligacao' ──────────────────────────

ALTER TABLE public.meetings_followups
  DROP CONSTRAINT IF EXISTS meetings_followups_channel_check;

ALTER TABLE public.meetings_followups
  ADD CONSTRAINT meetings_followups_channel_check
    CHECK (channel IN ('email', 'sms', 'whatsapp', 'phone', 'ligacao'));

-- ─── 3. Backfill channel from type for existing rules ───────────────────────

UPDATE public.meetings_followups
   SET channel = CASE type
     WHEN 'whatsapp_template' THEN 'whatsapp'
     WHEN 'whatsapp_texto'    THEN 'whatsapp'
     WHEN 'whatsapp_audio'    THEN 'whatsapp'
     WHEN 'email'             THEN 'email'
     WHEN 'email_texto'       THEN 'email'
     WHEN 'sms'               THEN 'sms'
     WHEN 'ligacao'           THEN 'ligacao'
     ELSE COALESCE(channel, 'whatsapp')
   END
 WHERE type IS NOT NULL;

-- ─── 4. Recreate trigger function with null-safe webhook handling ───────────

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
  -- Accepts rules with webhook_url OR whatsapp_template_id OR as_queue_id
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
    -- For all other statuses: schedule AFTER now (now + delay)
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
      scheduled_for, channel, webhook_url, message_snapshot, template_id
    ) VALUES (
      rule_rec.id,
      NEW.id,
      NEW.people_id,
      NEW.lead_id,
      v_scheduled,
      rule_rec.channel,
      rule_rec.webhook_url,           -- nullable now
      rule_rec.message,
      rule_rec.whatsapp_template_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;
