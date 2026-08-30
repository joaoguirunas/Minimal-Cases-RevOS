-- FEAT-AGENDAR-GCAL-FREEBUSY-01 — /agendar respeita o Google Calendar externo dos consultores.
-- Parte SQL: (1) get_booking_session expõe o pool real de candidatos por slot;
--            (2) book_meeting aceita p_exclude_user_ids (não atribui a quem está ocupado no GCal).
-- A lógica de freebusy vive na edge function booking-availability (availability + confirm).
-- Aplicado LIVE via db query (db push quebrado) + snapshots em backups/2026-06-12_*.
-- @no-rollback reason: backfill de estado já LIVE e estável (CREATE OR REPLACE idempotente em get_booking_session/book_meeting); reverter exigiria restaurar defs anteriores a partir dos snapshots em backups/2026-06-12_*, fora de escopo.
BEGIN;

-- FEAT-AGENDAR-GCAL-FREEBUSY-01 — get_booking_session: user_ids = pool real de candidatos
-- Mudança vs FIX-AGENDAR-PAGE-01 v2:
--   * A janela de horários continua vindo de settings_schedules dos elegíveis (igual).
--   * Mas o slot agora aparece se ≥1 consultor ELEGÍVEL+ATIVO estiver livre na agenda
--     interna naquele horário (não só o dono do horário) — alinhado ao book_meeting,
--     que distribui a reunião entre TODOS os elegíveis por load-balance.
--   * Cada slot expõe user_ids = exatamente esse pool de candidatos, para a edge
--     function `booking-availability` subtrair o Google Calendar externo por consultor.
CREATE OR REPLACE FUNCTION public.get_booking_session(p_lead_id uuid, p_rule_set_id uuid DEFAULT NULL::uuid, p_duration integer DEFAULT 30, p_days_ahead integer DEFAULT 14)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first_name text;
  v_user_ids uuid[];
  v_slots json;
  v_existing public.meetings%ROWTYPE;
  v_existing_consultor_name text;
BEGIN
  SELECT split_part(COALESCE(cp.name, 'Cliente'), ' ', 1)
    INTO v_first_name
    FROM public.leads l
    LEFT JOIN public.clients_people cp ON cp.id = l.people_id
    WHERE l.id = p_lead_id;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Lead not found'); END IF;

  -- #3 — reunião ativa futura já marcada para este lead → retorna sem gerar slots
  SELECT m.* INTO v_existing
    FROM public.meetings m
    WHERE m.lead_id = p_lead_id
      AND m.status NOT IN ('cancelado', 'cancelada')
      AND m.end_time > NOW()
    ORDER BY m.start_time ASC
    LIMIT 1;
  IF FOUND THEN
    SELECT su.name INTO v_existing_consultor_name
      FROM public.settings_users su WHERE su.id = v_existing.user_id;
    RETURN json_build_object(
      'person', json_build_object('name', v_first_name),
      'slots', '[]'::json,
      'existing_meeting', json_build_object(
        'meeting_id', v_existing.id::text,
        'start_time', to_char(v_existing.start_time AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS'),
        'end_time',   to_char(v_existing.end_time   AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS'),
        'consultor', json_build_object(
          'id', v_existing.user_id::text,
          'name', v_existing_consultor_name
        )
      )
    );
  END IF;

  v_user_ids := public.get_booking_eligible_user_ids(p_rule_set_id);
  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Nenhum consultor disponível no momento');
  END IF;

  SELECT json_agg(json_build_object('date', slot_date, 'start_time', start_time, 'end_time', end_time, 'user_ids', user_ids) ORDER BY slot_date, start_time)
    INTO v_slots
    FROM (
      SELECT g.slot_date, g.start_time, g.end_time,
        ( SELECT json_agg(DISTINCT su.id)
            FROM public.settings_users su
            WHERE su.id = ANY(v_user_ids)
              AND su.active = true
              AND NOT EXISTS (
                SELECT 1 FROM public.meetings m
                WHERE m.user_id = su.id
                  AND m.start_time < g.ts_end::timestamptz
                  AND m.end_time   > g.ts_start::timestamptz
                  AND m.status NOT IN ('cancelado', 'cancelada')
              )
        ) AS user_ids
      FROM (
        -- janela de horários: distinct times dos horários de trabalho dos elegíveis, só futuros
        SELECT DISTINCT slot_date, start_time, end_time, ts_start, ts_end
        FROM (
          SELECT
            TO_CHAR(dr.d, 'YYYY-MM-DD') AS slot_date,
            TO_CHAR(ss.start_time::time + (n.n * INTERVAL '30 minutes'), 'HH24:MI') AS start_time,
            TO_CHAR(ss.start_time::time + (n.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute'), 'HH24:MI') AS end_time,
            dr.d + (ss.start_time::time + (n.n * INTERVAL '30 minutes')) AS ts_start,
            dr.d + (ss.start_time::time + (n.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute')) AS ts_end
          FROM (SELECT (CURRENT_DATE + s.n)::date AS d FROM generate_series(0, p_days_ahead - 1) AS s(n)) AS dr
          CROSS JOIN (SELECT unnest(v_user_ids) AS id) AS cand
          INNER JOIN public.settings_users su ON su.id = cand.id AND su.active = true
          INNER JOIN public.settings_schedules ss ON ss.user_id = su.id AND ss.day_of_week = EXTRACT(DOW FROM dr.d)::int AND ss.is_available = true
          CROSS JOIN LATERAL (
            SELECT s2.n FROM generate_series(0, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (ss.end_time::time - ss.start_time::time)) / 1800)::int - 1)) AS s2(n)
            WHERE ss.start_time::time + (s2.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute') <= ss.end_time::time
          ) AS n
        ) AS raw_slots
        WHERE raw_slots.ts_start > (NOW() AT TIME ZONE 'America/Sao_Paulo')
      ) AS g
    ) AS grouped
    WHERE user_ids IS NOT NULL;  -- só aparece se ≥1 consultor elegível livre na agenda interna

  RETURN json_build_object(
    'person', json_build_object('name', v_first_name),
    'slots', COALESCE(v_slots, '[]'::json)
  );
END;
$function$;

-- FEAT-AGENDAR-GCAL-FREEBUSY-01 — book_meeting: aceita p_exclude_user_ids
-- Base: book_meeting LIVE (FIX-AGENDAR-PAGE-01, com guard + move "Reunião Marcada").
-- Mudança única: novo param p_exclude_user_ids uuid[] DEFAULT '{}'. Consultores nessa
--   lista são REMOVIDOS da atribuição (specific_user E load-balance). A edge function
--   `booking-availability` (action=confirm) passa aí os consultores ocupados no Google
--   Calendar externo no horário escolhido → o book_meeting não atribui a reunião a quem
--   está ocupado no GCal. Backward-compatible: chamada sem o param ('{}') = comportamento
--   anterior (não exclui ninguém).
-- Drop da assinatura antiga (6 args) p/ evitar overload + ambiguidade no PostgREST.
DROP FUNCTION IF EXISTS public.book_meeting(uuid, timestamp with time zone, timestamp with time zone, uuid, integer, text);
CREATE OR REPLACE FUNCTION public.book_meeting(p_lead_id uuid, p_start_time timestamp with time zone, p_end_time timestamp with time zone, p_rule_set_id uuid DEFAULT NULL::uuid, p_duration integer DEFAULT 30, p_notes text DEFAULT NULL::text, p_exclude_user_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id       uuid;
  v_user_name     text;
  v_meeting_id    uuid;
  v_title         text;
  v_people_id     uuid;
  v_eligible_ids  uuid[];
BEGIN
  -- #3 backstop — bloqueia duplo agendamento caso o frontend seja burlado.
  IF EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.lead_id = p_lead_id
      AND m.status NOT IN ('cancelado', 'cancelada')
      AND m.end_time > NOW()
  ) THEN
    RETURN json_build_object('error', 'already_booked');
  END IF;

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
      AND su.id <> ALL(p_exclude_user_ids)            -- GCal: pula quem está ocupado externamente
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
      AND su.id <> ALL(p_exclude_user_ids)            -- GCal: pula quem está ocupado externamente
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

  -- Avança o lead para "Reunião Marcada" do pipeline ATUAL dele (curso ou mentoria).
  UPDATE public.leads l
  SET leads_stages_id = rm.id
  FROM public.leads_stages rm
  WHERE l.id = p_lead_id
    AND rm.leads_pipelines_id = l.leads_pipelines_id
    AND rm.name = 'Reunião Marcada'
    AND rm.active = true;

  RETURN json_build_object(
    'meeting_id', v_meeting_id::text,
    'consultor', json_build_object(
      'id',   v_user_id::text,
      'name', v_user_name
    )
  );
END;
$function$;

COMMIT;
