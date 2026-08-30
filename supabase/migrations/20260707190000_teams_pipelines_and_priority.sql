-- Equipes por pipeline + prioridade de usuário no agendamento
--
-- 1. settings_teams_pipelines (N:N) — equipe sem nenhuma linha aqui = atende
--    TODOS os pipelines (default retrocompatível: nada muda até alguém
--    vincular um pipeline pela UI nova).
-- 2. settings_users_teams.is_priority — usuário prioritário na equipe: se
--    livre no horário pedido, agenda com ele antes do load-balance normal.
-- 3. get_booking_eligible_user_ids / get_booking_session / book_meeting
--    passam a filtrar por pipeline do lead e a tentar prioritário primeiro.

-- ── 1. settings_teams_pipelines ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.settings_teams_pipelines (
  team_id     uuid NOT NULL REFERENCES public.settings_teams(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.leads_pipelines(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, pipeline_id)
);

ALTER TABLE public.settings_teams_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY authenticated_read ON public.settings_teams_pipelines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY authenticated_write ON public.settings_teams_pipelines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 2. settings_users_teams.is_priority ─────────────────────────────────────

ALTER TABLE public.settings_users_teams
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;

-- ── 3a. get_booking_eligible_user_ids — + filtro de pipeline ────────────────

CREATE OR REPLACE FUNCTION public.get_booking_eligible_user_ids(
  p_rule_set_id uuid DEFAULT NULL::uuid,
  p_pipeline_id uuid DEFAULT NULL::uuid
)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rs_id           uuid;
  v_rule_team_ids   text[];
  v_found_team_rule boolean := false;
  v_team_user_ids   uuid[];
  v_result          uuid[];
  v_filtered        uuid[];
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
      END IF;
    END IF;
  END IF;

  -- Sem filtro de time (ou nenhum membro encontrado): todos os usuários ativos
  IF v_result IS NULL OR array_length(v_result, 1) IS NULL THEN
    SELECT ARRAY(
      SELECT su.id
      FROM public.settings_users su
      WHERE su.active = true
        AND (su.deleted_at IS NULL)
    ) INTO v_result;
  END IF;

  -- Filtro de pipeline: restringe a usuários de equipe(s) elegível(eis) pra
  -- esse pipeline. Equipe sem nenhuma linha em settings_teams_pipelines =
  -- atende todos os pipelines (universal). Se o filtro zerar o pool, ignora
  -- (mesmo princípio defensivo do filtro de time acima — nunca trava o
  -- agendamento por config incompleta).
  IF p_pipeline_id IS NOT NULL THEN
    SELECT ARRAY(
      SELECT DISTINCT su.id
      FROM public.settings_users su
      INNER JOIN public.settings_users_teams sut ON sut.user_id = su.id
      INNER JOIN public.settings_teams st ON st.id = sut.team_id
      WHERE su.id = ANY(v_result)
        AND (
          NOT EXISTS (SELECT 1 FROM public.settings_teams_pipelines stp WHERE stp.team_id = st.id)
          OR EXISTS (
            SELECT 1 FROM public.settings_teams_pipelines stp
            WHERE stp.team_id = st.id AND stp.pipeline_id = p_pipeline_id
          )
        )
    ) INTO v_filtered;

    IF v_filtered IS NOT NULL AND array_length(v_filtered, 1) > 0 THEN
      v_result := v_filtered;
    END IF;
  END IF;

  RETURN v_result;
END;
$function$;

-- ── 3b. get_booking_session — repassa o pipeline do lead ────────────────────

CREATE OR REPLACE FUNCTION public.get_booking_session(p_lead_id uuid, p_rule_set_id uuid DEFAULT NULL::uuid, p_duration integer DEFAULT 30, p_days_ahead integer DEFAULT 14)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first_name text;
  v_has_email  boolean;
  v_pipeline_id uuid;
  v_user_ids uuid[];
  v_slots json;
  v_existing public.meetings%ROWTYPE;
  v_existing_consultor_name text;
BEGIN
  SELECT split_part(COALESCE(cp.name, 'Cliente'), ' ', 1),
         (cp.email IS NOT NULL AND btrim(cp.email) <> ''),
         l.leads_pipelines_id
    INTO v_first_name, v_has_email, v_pipeline_id
    FROM public.leads l
    LEFT JOIN public.clients_people cp ON cp.id = l.people_id
    WHERE l.id = p_lead_id;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Lead not found'); END IF;
  v_has_email := COALESCE(v_has_email, false);

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
      'person', json_build_object('name', v_first_name, 'has_email', v_has_email),
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

  v_user_ids := public.get_booking_eligible_user_ids(p_rule_set_id, v_pipeline_id);
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
    'person', json_build_object('name', v_first_name, 'has_email', v_has_email),
    'slots', COALESCE(v_slots, '[]'::json)
  );
END;
$function$;

-- ── 3c. book_meeting (7 args, público) — pipeline + prioritário ─────────────

CREATE OR REPLACE FUNCTION public.book_meeting(
  p_lead_id uuid,
  p_start_time timestamp with time zone,
  p_end_time timestamp with time zone,
  p_rule_set_id uuid DEFAULT NULL::uuid,
  p_duration integer DEFAULT 30,
  p_notes text DEFAULT NULL::text,
  p_exclude_user_ids uuid[] DEFAULT '{}'::uuid[]
)
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
  v_pipeline_id   uuid;
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

  -- Resolve people_id e pipeline do lead
  SELECT people_id, leads_pipelines_id INTO v_people_id, v_pipeline_id
    FROM public.leads WHERE id = p_lead_id;

  v_eligible_ids := public.get_booking_eligible_user_ids(p_rule_set_id, v_pipeline_id);

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

  -- Prioritário na equipe: tenta antes do load-balance geral. Só é pulado se
  -- estiver ocupado/indisponível no horário (ou excluído por conflito no
  -- Google Calendar). Mais de um prioritário livre → mesmo tie-break do
  -- load-balance geral (menos reuniões futuras, depois mais tempo sem lead).
  IF v_user_id IS NULL THEN
    SELECT su.id, su.name
    INTO v_user_id, v_user_name
    FROM public.settings_users su
    WHERE su.id = ANY(v_eligible_ids)
      AND su.active = true
      AND su.id <> ALL(p_exclude_user_ids)
      AND EXISTS (
        SELECT 1 FROM public.settings_users_teams sut
        WHERE sut.user_id = su.id AND sut.is_priority = true
      )
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
