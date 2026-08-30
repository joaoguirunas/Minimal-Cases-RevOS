-- =============================================================================
-- Migration: P6 — FK Column Consistency
-- =============================================================================
-- Renames plural/inconsistent FK column names to singular English:
--   users_id    → user_id   (leads, leads_files, leads_notes, leads_updates,
--                             meetings, messages)
--   leads_id    → lead_id   (leads_files, leads_notes, leads_updates,
--                             meeting_followup_queue, meetings, messages,
--                             ai_agents_steps_history)
--   companies_id → company_id (leads)
--
-- Special cases:
--   ai_agents_execution_log.leads_id — DROP (lead_id already exists)
--
-- Also recreates 5 DB functions whose bodies reference old column names:
--   get_available_slots, get_booking_session,
--   book_meeting (both overloads), handle_meeting_followup_queue
-- =============================================================================

BEGIN;

-- ============================================================
-- STEP 1: Drop duplicate FK column
-- ============================================================
-- ai_agents_execution_log already has lead_id; leads_id is a redundant duplicate
ALTER TABLE public.ai_agents_execution_log DROP COLUMN IF EXISTS leads_id;


-- ============================================================
-- STEP 2: Rename leads_id → lead_id
-- ============================================================
ALTER TABLE public.ai_agents_steps_history  RENAME COLUMN leads_id TO lead_id;
ALTER TABLE public.leads_files              RENAME COLUMN leads_id TO lead_id;
ALTER TABLE public.leads_notes              RENAME COLUMN leads_id TO lead_id;
ALTER TABLE public.leads_updates            RENAME COLUMN leads_id TO lead_id;
ALTER TABLE public.meeting_followup_queue   RENAME COLUMN leads_id TO lead_id;
ALTER TABLE public.meetings                 RENAME COLUMN leads_id TO lead_id;
ALTER TABLE public.messages                 RENAME COLUMN leads_id TO lead_id;


-- ============================================================
-- STEP 3: Rename users_id → user_id
-- ============================================================
ALTER TABLE public.leads         RENAME COLUMN users_id TO user_id;
ALTER TABLE public.leads_files   RENAME COLUMN users_id TO user_id;
ALTER TABLE public.leads_notes   RENAME COLUMN users_id TO user_id;
ALTER TABLE public.leads_updates RENAME COLUMN users_id TO user_id;
ALTER TABLE public.meetings      RENAME COLUMN users_id TO user_id;
ALTER TABLE public.messages      RENAME COLUMN users_id TO user_id;


-- ============================================================
-- STEP 4: Rename companies_id → company_id
-- ============================================================
ALTER TABLE public.leads RENAME COLUMN companies_id TO company_id;


-- ============================================================
-- STEP 5: Recreate DB functions that reference old column names
-- ============================================================

-- 5a. get_available_slots — references meetings.users_id
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_user_id      UUID,
  p_date         DATE,
  p_period       TEXT DEFAULT NULL,
  p_slot_minutes INT  DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow          INT;
  v_user_name    TEXT;
  v_result       JSONB := '[]'::JSONB;
  v_period_start TIME;
  v_period_end   TIME;
  rec            RECORD;
  v_cursor       TIME;
  v_slot_end     TIME;
  v_is_free      BOOLEAN;
BEGIN
  IF p_slot_minutes < 15 OR p_slot_minutes > 480 THEN
    RAISE EXCEPTION 'p_slot_minutes must be between 15 and 480';
  END IF;

  SELECT name INTO v_user_name
  FROM settings_users
  WHERE id = p_user_id AND active = TRUE AND deleted_at IS NULL;

  IF v_user_name IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  v_dow := EXTRACT(DOW FROM p_date)::INT;

  IF p_period = 'morning' THEN
    v_period_start := '08:00'::TIME;
    v_period_end   := '12:00'::TIME;
  ELSIF p_period = 'afternoon' THEN
    v_period_start := '12:00'::TIME;
    v_period_end   := '18:00'::TIME;
  ELSIF p_period = 'evening' THEN
    v_period_start := '18:00'::TIME;
    v_period_end   := '22:00'::TIME;
  ELSE
    v_period_start := '00:00'::TIME;
    v_period_end   := '23:59'::TIME;
  END IF;

  FOR rec IN
    SELECT
      GREATEST(ss.start_time, v_period_start) AS win_start,
      LEAST(ss.end_time, v_period_end)        AS win_end
    FROM settings_schedules ss
    WHERE ss.user_id      = p_user_id
      AND ss.day_of_week  = v_dow
      AND ss.is_available = TRUE
      AND ss.start_time   < v_period_end
      AND ss.end_time     > v_period_start
    ORDER BY ss.start_time
  LOOP
    v_cursor := rec.win_start;

    WHILE v_cursor + (p_slot_minutes || ' minutes')::INTERVAL <= rec.win_end LOOP
      v_slot_end := (v_cursor + (p_slot_minutes || ' minutes')::INTERVAL)::TIME;

      SELECT NOT EXISTS (
        SELECT 1
        FROM meetings m
        WHERE m.user_id = p_user_id
          AND m.status NOT IN ('cancelada', 'cancelado')
          AND m.start_time < (p_date + v_slot_end)::TIMESTAMPTZ
          AND m.end_time   > (p_date + v_cursor)::TIMESTAMPTZ
      ) INTO v_is_free;

      IF v_is_free THEN
        v_result := v_result || jsonb_build_object(
          'slot_start', TO_CHAR(v_cursor, 'HH24:MI'),
          'slot_end',   TO_CHAR(v_slot_end, 'HH24:MI'),
          'user_id',    p_user_id,
          'user_name',  v_user_name
        );
      END IF;

      v_cursor := v_slot_end;
    END LOOP;
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, DATE, TEXT, INT)
  TO authenticated, service_role;


-- 5b. get_booking_session — references meetings.users_id
CREATE OR REPLACE FUNCTION public.get_booking_session(
  p_lead_id     uuid,
  p_rule_set_id uuid    DEFAULT NULL,
  p_duration    integer DEFAULT 30,
  p_days_ahead  integer DEFAULT 14
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person_id    uuid;
  v_person_name  text;
  v_person_email text;
  v_user_ids     uuid[];
  v_slots        json;
BEGIN
  SELECT
    COALESCE(cp.id, p_lead_id),
    COALESCE(cp.name, 'Cliente'),
    cp.email
  INTO v_person_id, v_person_name, v_person_email
  FROM public.leads l
  LEFT JOIN public.clients_people cp ON cp.id = l.people_id
  WHERE l.id = p_lead_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Lead not found');
  END IF;

  v_user_ids := public.get_booking_eligible_user_ids(p_rule_set_id);

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Nenhum consultor disponível no momento');
  END IF;

  SELECT json_agg(
    json_build_object(
      'date',       slot_date,
      'start_time', start_time,
      'end_time',   end_time
    )
    ORDER BY slot_date, start_time
  )
  INTO v_slots
  FROM (
    SELECT DISTINCT
      TO_CHAR(dr.d, 'YYYY-MM-DD') AS slot_date,
      TO_CHAR(ss.start_time::time + (n.n * INTERVAL '30 minutes'), 'HH24:MI') AS start_time,
      TO_CHAR(ss.start_time::time + (n.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute'), 'HH24:MI') AS end_time,
      su.id AS user_id,
      dr.d + (ss.start_time::time + (n.n * INTERVAL '30 minutes')) AS ts_start,
      dr.d + (ss.start_time::time + (n.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute')) AS ts_end
    FROM
      (SELECT (CURRENT_DATE + s.n)::date AS d
       FROM generate_series(0, p_days_ahead - 1) AS s(n)) AS dr
      CROSS JOIN (SELECT unnest(v_user_ids) AS id) AS cand
      INNER JOIN public.settings_users su ON su.id = cand.id AND su.active = true
      INNER JOIN public.settings_schedules ss
        ON ss.user_id = su.id
        AND ss.day_of_week = EXTRACT(DOW FROM dr.d)::int
        AND ss.is_available = true
      CROSS JOIN LATERAL (
        SELECT s2.n
        FROM generate_series(0,
          GREATEST(0,
            FLOOR(
              EXTRACT(EPOCH FROM (ss.end_time::time - ss.start_time::time)) / 1800
            )::int - 1
          )
        ) AS s2(n)
        WHERE ss.start_time::time + (s2.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute')
              <= ss.end_time::time
      ) AS n
  ) AS all_slots
  WHERE NOT EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.user_id    = all_slots.user_id
      AND m.start_time < all_slots.ts_end::timestamptz
      AND m.end_time   > all_slots.ts_start::timestamptz
      AND m.status NOT IN ('cancelado', 'cancelada')
  );

  RETURN json_build_object(
    'person', json_build_object(
      'id',    v_person_id::text,
      'name',  v_person_name,
      'email', v_person_email
    ),
    'slots', COALESCE(v_slots, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_session(uuid, uuid, integer, integer)
  TO anon, authenticated;


-- 5c. book_meeting (public booking, 6-param) — references meetings.lead_id + user_id
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
  v_eligible_ids  uuid[];
BEGIN
  v_eligible_ids := public.get_booking_eligible_user_ids(p_rule_set_id);

  IF v_eligible_ids IS NULL OR array_length(v_eligible_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Nenhum consultor disponível');
  END IF;

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
    lead_id, user_id, title, start_time, end_time, status, notes, source
  )
  VALUES (
    p_lead_id, v_user_id, v_title,
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


-- 5d. book_meeting (N8N MCP, 6-param with explicit user) — references meetings.lead_id + user_id
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
  v_date       DATE;
  v_start_time TIME;
  v_end_time   TIME;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'book_meeting: lead % not found', p_lead_id;
  END IF;

  v_date       := p_start_ts::DATE;
  v_start_time := p_start_ts::TIME;
  v_end_time   := (p_start_ts + (p_duration_minutes || ' minutes')::INTERVAL)::TIME;

  INSERT INTO public.meetings (
    lead_id, user_id, date, start_time, end_time, notes, status, source
  )
  VALUES (
    p_lead_id, p_user_id, v_date, v_start_time, v_end_time,
    COALESCE(p_title || E'\n\n' || p_notes, p_title),
    'agendado',
    'ai_agent'
  )
  RETURNING id INTO v_meeting_id;

  RETURN v_meeting_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_meeting(UUID, UUID, TEXT, TIMESTAMPTZ, INT, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.book_meeting(UUID, UUID, TEXT, TIMESTAMPTZ, INT, TEXT) IS
  'N8N MCP: Creates a meeting from AI agent. Returns new meeting UUID.';


-- 5e. handle_meeting_followup_queue — references meetings.lead_id + meeting_followup_queue.lead_id
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
  IF (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  v_status := CASE NEW.status
    WHEN 'agendada'       THEN 'agendado'
    WHEN 'compareceu'     THEN 'compareceu'
    WHEN 'nao_compareceu' THEN 'nao_compareceu'
    WHEN 'cancelado'      THEN 'cancelado'
    ELSE NEW.status
  END;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.meeting_followup_queue
       SET status = 'cancelled'
     WHERE meeting_id = NEW.id
       AND status = 'pending';
  END IF;

  IF v_status = 'cancelado' THEN
    RETURN NEW;
  END IF;

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

-- Trigger already exists; recreate to pick up updated function body
DROP TRIGGER IF EXISTS trg_meeting_followup_queue ON public.meetings;

CREATE TRIGGER trg_meeting_followup_queue
  AFTER INSERT OR UPDATE OF status
  ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_meeting_followup_queue();


-- ============================================================
-- STEP 6: Verify — all 4 renamed columns exist in correct tables
-- ============================================================
DO $$
DECLARE
  missing text := '';
  checks  text[] := ARRAY[
    'ai_agents_steps_history.lead_id',
    'leads_files.lead_id',
    'leads_files.user_id',
    'leads_notes.lead_id',
    'leads_notes.user_id',
    'leads_updates.lead_id',
    'leads_updates.user_id',
    'meeting_followup_queue.lead_id',
    'meetings.lead_id',
    'meetings.user_id',
    'messages.lead_id',
    'messages.user_id',
    'leads.user_id',
    'leads.company_id'
  ];
  check_item text;
  tbl text;
  col text;
  cnt int;
BEGIN
  FOREACH check_item IN ARRAY checks LOOP
    tbl := split_part(check_item, '.', 1);
    col := split_part(check_item, '.', 2);
    SELECT count(*) INTO cnt
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = tbl
      AND column_name  = col;
    IF cnt = 0 THEN
      missing := missing || check_item || ' ';
    END IF;
  END LOOP;

  IF missing <> '' THEN
    RAISE EXCEPTION 'P6 verification failed — missing columns: %', missing;
  ELSE
    RAISE NOTICE 'P6 verified OK — all renamed columns exist';
  END IF;
END;
$$;

COMMIT;
