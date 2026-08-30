-- book_meeting: RPC pública para confirmar agendamento via página de booking
-- Chamada pelo frontend via supabase.rpc('book_meeting', {...})
-- Substitui a action 'confirm' do edge function public-booking (não precisa de deploy)

CREATE OR REPLACE FUNCTION public.book_meeting(
  p_lead_id    uuid,
  p_start_time timestamptz,
  p_end_time   timestamptz,
  p_rule_set_id uuid    DEFAULT NULL,
  p_duration   integer  DEFAULT 30,
  p_notes      text     DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_user_name text;
  v_meeting_id uuid;
  v_title     text;
  v_rs_id     uuid;
BEGIN
  -- Resolve rule set (provided ou default)
  IF p_rule_set_id IS NOT NULL THEN
    v_rs_id := p_rule_set_id;
  ELSE
    SELECT id INTO v_rs_id
    FROM public.booking_rule_sets
    WHERE is_default = true AND is_active = true
    LIMIT 1;
  END IF;

  -- Encontra o melhor consultor disponível no horário escolhido
  SELECT su.id, su.name
  INTO v_user_id, v_user_name
  FROM public.settings_users su
  WHERE su.active = true
    AND (su.deleted_at IS NULL)
    -- Sem conflito de reunião neste horário
    AND NOT EXISTS (
      SELECT 1
      FROM public.meetings m
      WHERE m.users_id = su.id
        AND m.start_time < p_end_time
        AND m.end_time   > p_start_time
        AND m.status NOT IN ('cancelado', 'cancelada')
    )
  ORDER BY
    -- Prioridade 1: specific_user definido nas regras
    CASE WHEN v_rs_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.booking_rules br
      WHERE br.rule_set_id = v_rs_id
        AND br.rule_type   = 'specific_user'
        AND br.is_active   = true
        AND (br.config->>'user_id')::uuid = su.id
    ) THEN 0 ELSE 1 END ASC,
    -- Prioridade 2: menos reuniões futuras (least_busy)
    (
      SELECT COUNT(*)
      FROM public.meetings m2
      WHERE m2.users_id = su.id
        AND m2.start_time >= NOW()
        AND m2.status NOT IN ('cancelado', 'cancelada')
    ) ASC,
    -- Prioridade 3: quem recebeu reunião há mais tempo (round robin)
    COALESCE((
      SELECT MAX(m3.created_at)
      FROM public.meetings m3
      WHERE m3.users_id = su.id
    ), '1970-01-01'::timestamptz) ASC
  LIMIT 1;

  -- Nenhum consultor disponível neste horário
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Horário não disponível — escolha outro horário');
  END IF;

  -- Gera título da reunião
  v_title := 'Reunião agendada — ' ||
    TO_CHAR(p_start_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  -- Insere a reunião
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

-- Permite chamada pelo cliente anônimo (página pública de booking)
GRANT EXECUTE ON FUNCTION public.book_meeting(uuid, timestamptz, timestamptz, uuid, integer, text)
  TO anon, authenticated;
