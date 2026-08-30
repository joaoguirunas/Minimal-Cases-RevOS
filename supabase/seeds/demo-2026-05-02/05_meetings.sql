-- =====================================================================
-- Arquivo:  05_meetings.sql
-- Time:     ora-sim-dados-apresentacao
-- Tabelas:  meetings
-- Volumes:  20 reuniões (12 compareceu + 5 agendado + 2 nao_compareceu + 1 cancelado)
-- Depende:  02_people_leads.sql (leads + pessoas existem com marker)
-- Marker:   [DEMO_SEED_2026-05-02] em description
-- =====================================================================

DO $$
DECLARE
  v_owner_id    uuid;
  v_lead        record;
  v_existing    int;
  v_seq         int := 0;
  v_status      text;
  v_type        text;
  v_start       timestamptz;
  v_now         timestamptz := timestamptz '2026-05-02 18:00:00+00';
  v_inserted    int := 0;
BEGIN
  SELECT id INTO v_owner_id
  FROM public.settings_users
  WHERE email = 'outreachrelationship@gmail.com'
  LIMIT 1;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner não encontrado — rodar 01 antes';
  END IF;

  SELECT count(*) INTO v_existing
  FROM public.meetings
  WHERE description LIKE '%[DEMO_SEED_2026-05-02]%'
    AND user_id = v_owner_id;

  IF v_existing >= 20 THEN
    RAISE NOTICE '05_meetings: já há % reuniões marker — pulando', v_existing;
    RETURN;
  END IF;

  -- Loop pelos 20 primeiros leads marker (cronológico) — 1 reunião por lead
  FOR v_lead IN
    SELECT l.id AS lead_id, l.people_id, l.created_at,
           p.name AS person_name, p.email AS person_email
    FROM public.leads l
    JOIN public.clients_people p ON p.id = l.people_id
    WHERE l.description LIKE '%[DEMO_SEED_2026-05-02]%'
      AND l.user_id = v_owner_id
    ORDER BY l.created_at, l.id
    LIMIT 20
  LOOP
    v_seq := v_seq + 1;

    -- Distribuição de status:
    --   v_seq 1..12  → compareceu
    --   v_seq 13..17 → agendado (futuro)
    --   v_seq 18..19 → nao_compareceu
    --   v_seq 20     → cancelado
    IF v_seq BETWEEN 1 AND 12 THEN
      v_status := 'compareceu';
      -- start_time entre 2026-04-23 e 2026-04-30 (passado)
      v_start := timestamptz '2026-04-23 14:00:00+00'
                 + make_interval(days => (v_seq - 1) % 8, hours => (v_seq - 1));
    ELSIF v_seq BETWEEN 13 AND 17 THEN
      v_status := 'agendado';
      -- start_time entre 2026-05-05 e 2026-05-15 (futuro)
      v_start := timestamptz '2026-05-05 10:00:00+00'
                 + make_interval(days => (v_seq - 13) * 2, hours => (v_seq - 13));
    ELSIF v_seq IN (18, 19) THEN
      v_status := 'nao_compareceu';
      v_start := timestamptz '2026-04-25 16:00:00+00' + make_interval(days => (v_seq - 18));
    ELSE
      v_status := 'cancelado';
      v_start := timestamptz '2026-04-29 11:00:00+00';
    END IF;

    -- meeting_type: maioria 'demo', alguns 'discovery'
    v_type := CASE WHEN v_seq % 4 = 0 THEN 'discovery' ELSE 'demo' END;

    INSERT INTO public.meetings (
      title, description, start_time, end_time,
      lead_id, people_id, user_id,
      status, meeting_type, location, meeting_link,
      attendee_emails, source,
      notes, outcome,
      created_at, updated_at
    )
    VALUES (
      'Demo ORA - ' || v_lead.person_name,
      'Reunião demo seed. [DEMO_SEED_2026-05-02]',
      v_start,
      v_start + interval '1 hour',
      v_lead.lead_id,
      v_lead.people_id,
      v_owner_id,
      v_status,
      v_type,
      'Online (Google Meet)',
      'https://meet.google.com/demo-seed-' || lpad(v_seq::text, 3, '0'),
      ARRAY['outreachrelationship@gmail.com', v_lead.person_email]::text[],
      'manual',
      CASE v_status
        WHEN 'compareceu' THEN 'Cliente engajado, demonstrou interesse em prosseguir.'
        WHEN 'nao_compareceu' THEN 'Cliente não compareceu, follow-up agendado.'
        WHEN 'cancelado' THEN 'Cancelado pelo cliente — reagendar.'
        ELSE NULL
      END,
      CASE v_status
        WHEN 'compareceu' THEN 'venda'
        WHEN 'nao_compareceu' THEN 'nao_compareceu'
        ELSE NULL
      END,
      v_start - interval '2 days',
      v_now
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RAISE NOTICE '05_meetings: % reuniões inseridas (12 compareceu + 5 agendado + 2 no-show + 1 cancelado)',
               v_inserted;
END $$;
