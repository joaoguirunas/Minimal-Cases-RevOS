-- get_booking_session: substitui a action 'session' do edge function public-booking
-- Garante que session e book_meeting usam EXATAMENTE os mesmos candidatos (filtro de time)
-- Frontend usa supabase.rpc('get_booking_session', {...}) em vez de functions.invoke

-- ── Helper: retorna IDs dos usuários elegíveis segundo as regras ──────────────
CREATE OR REPLACE FUNCTION public.get_booking_eligible_user_ids(
  p_rule_set_id uuid DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rs_id           uuid;
  v_rule_team_ids   text[];
  v_found_team_rule boolean := false;
  v_team_user_ids   uuid[];
  v_result          uuid[];
BEGIN
  -- Resolve rule set
  IF p_rule_set_id IS NOT NULL THEN
    v_rs_id := p_rule_set_id;
  ELSE
    SELECT id INTO v_rs_id
    FROM public.booking_rule_sets
    WHERE is_default = true AND is_active = true
    LIMIT 1;
  END IF;

  -- Verifica se existe regra team_priority
  IF v_rs_id IS NOT NULL THEN
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(br.config->'team_ids', '[]'::jsonb))
    )
    INTO v_rule_team_ids
    FROM public.booking_rules br
    WHERE br.rule_set_id = v_rs_id
      AND br.rule_type   = 'team_priority'
      AND br.is_active   = true
    ORDER BY br.order_index ASC
    LIMIT 1;

    v_found_team_rule := FOUND;

    IF v_found_team_rule THEN
      IF v_rule_team_ids IS NOT NULL AND array_length(v_rule_team_ids, 1) > 0 THEN
        -- Times específicos
        SELECT ARRAY(
          SELECT DISTINCT sut.user_id
          FROM public.settings_users_teams sut
          WHERE sut.team_id = ANY(v_rule_team_ids::uuid[])
        ) INTO v_team_user_ids;
      ELSE
        -- Qualquer membro de time ativo
        SELECT ARRAY(
          SELECT DISTINCT sut.user_id
          FROM public.settings_users_teams sut
          INNER JOIN public.settings_teams st ON st.id = sut.team_id
          WHERE st.active = true
        ) INTO v_team_user_ids;
      END IF;

      -- Se não encontrou nenhum membro, ignora filtro (evita quebrar tudo)
      IF v_team_user_ids IS NOT NULL AND array_length(v_team_user_ids, 1) > 0 THEN
        -- Filtra para usuários ativos que estão na lista do time
        SELECT ARRAY(
          SELECT su.id
          FROM public.settings_users su
          WHERE su.active = true
            AND (su.deleted_at IS NULL)
            AND su.id = ANY(v_team_user_ids)
        ) INTO v_result;
        RETURN v_result;
      END IF;
    END IF;
  END IF;

  -- Sem filtro de time: todos os usuários ativos
  SELECT ARRAY(
    SELECT su.id
    FROM public.settings_users su
    WHERE su.active = true
      AND (su.deleted_at IS NULL)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ── Principal: retorna person + slots disponíveis ────────────────────────────
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
  -- 1. Dados do lead / pessoa
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

  -- 2. Usuários elegíveis (aplica filtro de time igual ao book_meeting)
  v_user_ids := public.get_booking_eligible_user_ids(p_rule_set_id);

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Nenhum consultor disponível no momento');
  END IF;

  -- 3. Gera slots disponíveis (union de todos os candidatos, sem revelar quem é)
  --    Slots gerados a cada 30 min dentro do horário de trabalho de cada consultor
  --    Exclui slots com conflito de reunião existente para aquele consultor
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
      -- Próximos N dias
      (SELECT (CURRENT_DATE + s.n)::date AS d
       FROM generate_series(0, p_days_ahead - 1) AS s(n)) AS dr
      -- Candidatos elegíveis
      CROSS JOIN (
        SELECT unnest(v_user_ids) AS id
      ) AS cand
      -- Usuários ativos
      INNER JOIN public.settings_users su ON su.id = cand.id AND su.active = true
      -- Horários semanais do usuário que batem com o dia da semana
      INNER JOIN public.settings_schedules ss
        ON ss.user_id = su.id
        AND ss.day_of_week = EXTRACT(DOW FROM dr.d)::int
        AND ss.is_available = true
      -- Gera slots de 30 em 30 min dentro do horário
      CROSS JOIN LATERAL (
        SELECT s2.n
        FROM generate_series(0,
          GREATEST(0,
            FLOOR(
              EXTRACT(EPOCH FROM (ss.end_time::time - ss.start_time::time)) / 1800
            )::int - 1
          )
        ) AS s2(n)
        -- Slot completo cabe dentro do horário
        WHERE ss.start_time::time + (s2.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute')
              <= ss.end_time::time
      ) AS n
  ) AS all_slots
  -- Exclui slots com conflito de reunião para este consultor
  WHERE NOT EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.users_id  = all_slots.user_id
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

-- Permissões públicas (página de booking não tem auth)
GRANT EXECUTE ON FUNCTION public.get_booking_eligible_user_ids(uuid)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_booking_session(uuid, uuid, integer, integer)
  TO anon, authenticated;
