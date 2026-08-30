-- AGENDA-GCAL-03 — captura segura do email do lead no /agendar (público/anônimo).
-- DOIS writes, sem migration de schema (clients_people.email já existe):
--   1) RPC set_booking_lead_email(p_lead_id, p_email) SECURITY DEFINER — escopada ao lead
--      do link (NUNCA people_id arbitrário = anti-IDOR), valida formato, não sobrescreve
--      email pré-existente. anon-callable (mesmo modelo de book_meeting/get_booking_session).
--   2) get_booking_session expõe person.has_email:boolean (sem expor o email — privacidade),
--      para o /agendar saber quando exibir o input de email. Backward-compatible.
-- Aplicado LIVE via db query (db push quebrado) + registro manual em schema_migrations.
-- Snapshot da def anterior de get_booking_session: backups/get_booking_session-PRE-AGENDA-GCAL-03-*.json
BEGIN;

-- ── (1) RPC set_booking_lead_email ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_booking_lead_email(p_lead_id uuid, p_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_people_id uuid;
  v_existing  text;
  v_clean     text;
BEGIN
  v_clean := lower(btrim(p_email));
  -- validação de formato server-side (a coluna não tem CHECK; rejeita lixo)
  IF v_clean IS NULL OR v_clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN json_build_object('error', 'invalid_email');
  END IF;

  -- escopo anti-IDOR: a pessoa é a do LEAD do link, nunca um people_id arbitrário
  SELECT people_id INTO v_people_id FROM public.leads WHERE id = p_lead_id;
  IF v_people_id IS NULL THEN
    RETURN json_build_object('error', 'lead_not_found');
  END IF;

  SELECT email INTO v_existing FROM public.clients_people WHERE id = v_people_id;
  -- não sobrescreve email válido pré-existente (anti-vazamento). '' conta como vazio.
  IF v_existing IS NOT NULL AND btrim(v_existing) <> '' THEN
    RETURN json_build_object('ok', true, 'skipped', 'already_has_email');
  END IF;

  UPDATE public.clients_people SET email = v_clean, updated_at = NOW() WHERE id = v_people_id;
  RETURN json_build_object('ok', true, 'people_id', v_people_id::text);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_booking_lead_email(uuid, text) TO anon, authenticated, service_role;

-- ── (2) get_booking_session — adiciona person.has_email (booleano) ────────────
-- Base = def LIVE da migration 20260612010000. Única mudança: captura v_has_email no
-- SELECT inicial e o adiciona ao objeto `person` nos DOIS RETURN (existing_meeting + slots).
CREATE OR REPLACE FUNCTION public.get_booking_session(p_lead_id uuid, p_rule_set_id uuid DEFAULT NULL::uuid, p_duration integer DEFAULT 30, p_days_ahead integer DEFAULT 14)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first_name text;
  v_has_email  boolean;
  v_user_ids uuid[];
  v_slots json;
  v_existing public.meetings%ROWTYPE;
  v_existing_consultor_name text;
BEGIN
  SELECT split_part(COALESCE(cp.name, 'Cliente'), ' ', 1),
         (cp.email IS NOT NULL AND btrim(cp.email) <> '')
    INTO v_first_name, v_has_email
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
    'person', json_build_object('name', v_first_name, 'has_email', v_has_email),
    'slots', COALESCE(v_slots, '[]'::json)
  );
END;
$function$;

COMMIT;
