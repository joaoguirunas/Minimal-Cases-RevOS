-- ══════════════════════════════════════════════════════════════════════════════
-- HOTFIX: meetings_status_check constraint blocking public bookings
--
-- Root cause: Migration 20260326130000 recreated book_meeting with 'agendada'
-- but P7 constraint (20260228000000) only allows 'agendado'.
-- Also missing: 'nao_compareceu' (used by followup trigger) and 'realizado'.
--
-- Fix: 1) Expand constraint to include ALL status values used across the system
--       2) Fix both book_meeting overloads to use canonical 'agendado'
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Expand CHECK constraint ────────────────────────────────────────────────

ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_status_check;

ALTER TABLE public.meetings ADD CONSTRAINT meetings_status_check
  CHECK (status = ANY (ARRAY[
    'agendado'::text,
    'agendada'::text,
    'compareceu'::text,
    'nao_compareceu'::text,
    'não compareceu'::text,
    'cancelado'::text,
    'cancelada'::text,
    'realizado'::text,
    'bloqueio manual'::text
  ]));

-- ─── 2. Fix book_meeting (public booking overload) — 'agendada' → 'agendado'

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
    'agendado', p_notes, 'public_booking'
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

-- ─── 3. Fix book_meeting (N8N/AI agent overload) — already uses 'agendado' ──

CREATE OR REPLACE FUNCTION public.book_meeting(
  p_lead_id          UUID,
  p_user_id          UUID,
  p_title            TEXT,
  p_start_ts         TIMESTAMPTZ,
  p_duration_minutes INT  DEFAULT 30,
  p_notes            TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting_id UUID;
  v_people_id  UUID;
  v_end_ts     TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'book_meeting: lead % not found', p_lead_id;
  END IF;

  SELECT people_id INTO v_people_id FROM public.leads WHERE id = p_lead_id;
  v_end_ts := p_start_ts + (p_duration_minutes || ' minutes')::INTERVAL;

  INSERT INTO public.meetings (
    lead_id, people_id, user_id, title, start_time, end_time, notes, status, source
  )
  VALUES (
    p_lead_id, v_people_id, p_user_id, p_title,
    p_start_ts, v_end_ts,
    p_notes,
    'agendado',
    'ai_agent'
  )
  RETURNING id INTO v_meeting_id;

  RETURN v_meeting_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_meeting(UUID, UUID, TEXT, TIMESTAMPTZ, INT, TEXT)
  TO authenticated, service_role;
