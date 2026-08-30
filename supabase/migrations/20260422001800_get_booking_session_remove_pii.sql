-- SCH-H-1 AC8 / SCH-H-2: Remove PII from get_booking_session public RPC.
-- Before: { person: { id, name, email }, slots }
-- After:  { person: { name: "<first_name_only>" }, slots }
--
-- email and id MUST NOT leave this RPC — granted to 'anon' (unauthenticated).
-- Slot generation logic is identical to the original (20260226220000).

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
  v_first_name   text;
  v_user_ids     uuid[];
  v_slots        json;
BEGIN
  -- 1. Lead / person lookup — only first name leaves this function (AC8)
  SELECT split_part(COALESCE(cp.name, 'Cliente'), ' ', 1)
  INTO v_first_name
  FROM public.leads l
  LEFT JOIN public.clients_people cp ON cp.id = l.people_id
  WHERE l.id = p_lead_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Lead not found');
  END IF;

  -- 2. Eligible consultants
  v_user_ids := public.get_booking_eligible_user_ids(p_rule_set_id);

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Nenhum consultor disponível no momento');
  END IF;

  -- 3. Available slots (identical to original — 30-min intervals within schedule)
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
          GREATEST(0, FLOOR(
            EXTRACT(EPOCH FROM (ss.end_time::time - ss.start_time::time)) / 1800
          )::int - 1)
        ) AS s2(n)
        WHERE ss.start_time::time + (s2.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute')
              <= ss.end_time::time
      ) AS n
  ) AS all_slots
  WHERE NOT EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.users_id  = all_slots.user_id
      AND m.start_time < all_slots.ts_end::timestamptz
      AND m.end_time   > all_slots.ts_start::timestamptz
      AND m.status NOT IN ('cancelado', 'cancelada')
  );

  RETURN json_build_object(
    'person', json_build_object('name', v_first_name),
    'slots',  COALESCE(v_slots, '[]'::json)
  );
END;
$$;
