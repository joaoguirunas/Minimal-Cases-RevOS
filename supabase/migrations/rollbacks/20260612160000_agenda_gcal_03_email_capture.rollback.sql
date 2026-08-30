-- ROLLBACK AGENDA-GCAL-03 — desfaz os 2 writes.
-- (1) DROP da RPC nova. (2) restaura get_booking_session à def da migration 20260612010000
--     (sem has_email no objeto person).
BEGIN;

DROP FUNCTION IF EXISTS public.set_booking_lead_email(uuid, text);

-- restaura get_booking_session SEM has_email (def de 20260612010000)
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
    WHERE user_ids IS NOT NULL;

  RETURN json_build_object(
    'person', json_build_object('name', v_first_name),
    'slots', COALESCE(v_slots, '[]'::json)
  );
END;
$function$;

COMMIT;
