-- Fix: book_meeting agora usa get_booking_eligible_user_ids (mesmo filtro do session)
-- Garante que os candidatos no confirm são EXATOS que os do session

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
  -- 1. Pega os candidatos elegíveis (mesmo filtro de time do session)
  v_eligible_ids := public.get_booking_eligible_user_ids(p_rule_set_id);

  IF v_eligible_ids IS NULL OR array_length(v_eligible_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Nenhum consultor disponível');
  END IF;

  -- 2. Tenta specific_user (override)
  IF p_rule_set_id IS NOT NULL THEN
    SELECT su.id, su.name
    INTO v_user_id, v_user_name
    FROM public.booking_rules br
    INNER JOIN public.settings_users su
      ON su.id = (br.config->>'user_id')::uuid
      AND su.active = true
      AND su.id = ANY(v_eligible_ids)        -- deve estar na lista elegível
    WHERE br.rule_set_id = p_rule_set_id
      AND br.rule_type   = 'specific_user'
      AND br.is_active   = true
      AND NOT EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.users_id  = su.id
          AND m.start_time < p_end_time
          AND m.end_time   > p_start_time
          AND m.status NOT IN ('cancelado', 'cancelada')
      )
    ORDER BY br.order_index ASC
    LIMIT 1;
  END IF;

  -- 3. Encontra melhor candidato elegível com slot livre
  IF v_user_id IS NULL THEN
    SELECT su.id, su.name
    INTO v_user_id, v_user_name
    FROM public.settings_users su
    WHERE su.id = ANY(v_eligible_ids)        -- SOMENTE elegíveis (filtro de time aplicado)
      AND su.active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.users_id  = su.id
          AND m.start_time < p_end_time
          AND m.end_time   > p_start_time
          AND m.status NOT IN ('cancelado', 'cancelada')
      )
    ORDER BY
      -- Least busy: menos reuniões futuras
      (SELECT COUNT(*) FROM public.meetings m2
       WHERE m2.users_id  = su.id
         AND m2.start_time >= NOW()
         AND m2.status NOT IN ('cancelado', 'cancelada')
      ) ASC,
      -- Round robin: quem recebeu reunião há mais tempo
      COALESCE((
        SELECT MAX(m3.created_at) FROM public.meetings m3
        WHERE m3.users_id = su.id
      ), '1970-01-01'::timestamptz) ASC
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Horário não disponível — escolha outro horário');
  END IF;

  -- 4. Cria a reunião
  v_title := 'Reunião agendada — ' ||
    TO_CHAR(p_start_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  INSERT INTO public.meetings (
    leads_id, users_id, title, start_time, end_time, status, notes, source
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
