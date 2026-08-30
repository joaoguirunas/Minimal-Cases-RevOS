-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: handle_meeting_followup_queue — resolve people_id from lead
--
-- Root cause: meetings often have lead_id but NOT people_id (book_meeting RPC
-- and GCal sync don't set people_id). The trigger blindly uses NEW.people_id
-- which is null → queue entry has no contact → edge function can't send.
--
-- Fix: When NEW.people_id is null but NEW.lead_id exists, look up
-- leads.people_id to resolve the contact. This covers all meeting sources.
--
-- Also fix book_meeting RPCs to populate people_id from the lead.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Fix trigger: resolve people_id from lead ──────────────────────────────

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

  -- Resolve people_id: use meeting's people_id, or look up from lead
  v_people_id := NEW.people_id;
  IF v_people_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT people_id INTO v_people_id
      FROM public.leads
     WHERE id = NEW.lead_id;
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
      rule_id, meeting_id, person_id, lead_id,
      scheduled_for, channel, webhook_url, message_snapshot, template_id
    ) VALUES (
      rule_rec.id,
      NEW.id,
      v_people_id,               -- resolved from lead if meeting has no people_id
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

-- ─── 2. Backfill: update existing pending queue entries with people_id ────────

UPDATE public.meeting_followup_queue q
   SET person_id = l.people_id
  FROM public.meetings m
  JOIN public.leads l ON l.id = m.lead_id
 WHERE q.meeting_id = m.id
   AND q.person_id IS NULL
   AND q.status = 'pending'
   AND l.people_id IS NOT NULL;

-- ─── 3. Fix book_meeting (public booking) to populate people_id ───────────────
-- This ensures future meetings created via book_meeting also have people_id

CREATE OR REPLACE FUNCTION public.book_meeting(
  p_lead_id     uuid,
  p_start_time  timestamptz,
  p_end_time    timestamptz,
  p_rule_set_id uuid    DEFAULT NULL,
  p_duration    integer DEFAULT 30,
  p_notes       text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid;
  v_user_name     text;
  v_meeting_id    uuid;
  v_title         text;
  v_people_id     uuid;
  v_eligible_ids  uuid[];
BEGIN
  v_eligible_ids := public.get_booking_eligible_user_ids(p_rule_set_id);

  IF v_eligible_ids IS NULL OR array_length(v_eligible_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Nenhum consultor disponível');
  END IF;

  -- Resolve people_id from lead
  SELECT people_id INTO v_people_id FROM public.leads WHERE id = p_lead_id;

  IF p_rule_set_id IS NOT NULL THEN
    SELECT su.id, su.name
    INTO v_user_id, v_user_name
    FROM public.booking_rules br
    INNER JOIN public.settings_users su
      ON su.id = (br.config->>'user_id')::uuid
      AND su.active = true
      AND su.id = ANY(v_eligible_ids)
    WHERE br.rule_set_id = p_rule_set_id
      AND br.rule_type   = 'specific_user'
      AND br.is_active   = true
      AND NOT EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.user_id    = su.id
          AND m.start_time < p_end_time
          AND m.end_time   > p_start_time
          AND m.status NOT IN ('cancelado', 'cancelada')
      )
    ORDER BY br.order_index ASC
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    SELECT su.id, su.name
    INTO v_user_id, v_user_name
    FROM public.settings_users su
    WHERE su.id = ANY(v_eligible_ids)
      AND su.active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.user_id    = su.id
          AND m.start_time < p_end_time
          AND m.end_time   > p_start_time
          AND m.status NOT IN ('cancelado', 'cancelada')
      )
    ORDER BY
      (SELECT COUNT(*) FROM public.meetings m2
       WHERE m2.user_id    = su.id
         AND m2.start_time >= NOW()
         AND m2.status NOT IN ('cancelado', 'cancelada')
      ) ASC,
      COALESCE((
        SELECT MAX(m3.created_at) FROM public.meetings m3
        WHERE m3.user_id = su.id
      ), '1970-01-01'::timestamptz) ASC
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Horário não disponível — escolha outro horário');
  END IF;

  v_title := 'Reunião agendada — ' ||
    TO_CHAR(p_start_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  INSERT INTO public.meetings (
    lead_id, people_id, user_id, title, start_time, end_time, status, notes, source
  )
  VALUES (
    p_lead_id, v_people_id, v_user_id, v_title,
    p_start_time, p_end_time,
    'agendada', p_notes, 'public_booking'
  )
  RETURNING id INTO v_meeting_id;

  RETURN json_build_object(
    'meeting_id', v_meeting_id::text,
    'consultor', json_build_object(
      'id',   v_user_id::text,
      'name', v_user_name
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_meeting(uuid, timestamptz, timestamptz, uuid, integer, text)
  TO anon, authenticated;
