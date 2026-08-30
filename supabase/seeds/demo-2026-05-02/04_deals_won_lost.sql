-- =====================================================================
-- Arquivo:  04_deals_won_lost.sql
-- Time:     ora-sim-dados-apresentacao
-- Tabelas:  leads (UPDATE), leads_notes (INSERT), leads_updates (INSERT)
-- Volumes:  20 leads → won + 5 leads → lost reforço + 10 notas
--           (5 leads ficam in_progress permanentes; 5 leads já entraram
--            como lost no 02 e aqui só ganham loss_reason se faltar)
-- Depende:  02_people_leads.sql (30 leads marker existem)
-- Marker:   [DEMO_SEED_2026-05-02]
-- =====================================================================

DO $$
DECLARE
  v_owner_id      uuid;
  v_won_ids       uuid[] := ARRAY[]::uuid[];
  v_won_id        uuid;
  v_lost_id       uuid;
  v_loss_reason   uuid;
  v_existing_won  int;
  v_existing_notes int;

  v_now           timestamptz := timestamptz '2026-05-02 18:00:00+00';
  v_won_at_base   timestamptz;
  v_seq           int := 0;

  v_won_notes text[] := ARRAY[
    'Cliente confirmou contrato e cronograma de implementação. [DEMO_SEED_2026-05-02]',
    'Proposta aceita após reunião de fechamento. [DEMO_SEED_2026-05-02]',
    'Negócio fechado — onboarding começa na próxima semana. [DEMO_SEED_2026-05-02]',
    'Faturado em 2026-05-01. Cliente animado com a integração. [DEMO_SEED_2026-05-02]',
    'Conseguimos contornar objeção de preço com flexibilização de prazo. [DEMO_SEED_2026-05-02]',
    'Closer Rafael fechou após 3 reuniões. [DEMO_SEED_2026-05-02]',
    'Indicação interna — ciclo curto, fechamento na primeira proposta. [DEMO_SEED_2026-05-02]',
    'Decisor aprovou após validação técnica do time deles. [DEMO_SEED_2026-05-02]',
    'Pagamento recorrente acordado, contrato anual. [DEMO_SEED_2026-05-02]',
    'Cliente expandiu escopo durante negociação. [DEMO_SEED_2026-05-02]'
  ];

BEGIN
  -- Owner
  SELECT id INTO v_owner_id
  FROM public.settings_users
  WHERE email = 'outreachrelationship@gmail.com'
  LIMIT 1;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner não encontrado — rodar 01 antes';
  END IF;

  -- Idempotência: se já há won com marker, pular UPDATE.
  SELECT count(*) INTO v_existing_won
  FROM public.leads
  WHERE description LIKE '%[DEMO_SEED_2026-05-02]%'
    AND user_id = v_owner_id
    AND status = 'won';

  IF v_existing_won >= 20 THEN
    RAISE NOTICE '04_deals: já há % leads won marker — UPDATE pulado', v_existing_won;
  ELSE
    -- 1) Pegar 20 leads in_progress mais antigos (para virarem won)
    --    e armazenar UUIDs para usar nas notas.
    WITH alvo AS (
      SELECT id
      FROM public.leads
      WHERE description LIKE '%[DEMO_SEED_2026-05-02]%'
        AND user_id = v_owner_id
        AND status = 'in_progress'
      ORDER BY created_at, id
      LIMIT 20
    )
    SELECT array_agg(id) INTO v_won_ids FROM alvo;

    IF v_won_ids IS NULL OR array_length(v_won_ids, 1) < 20 THEN
      RAISE EXCEPTION '04_deals: esperava 20+ leads in_progress, encontrou %',
                      COALESCE(array_length(v_won_ids, 1), 0);
    END IF;

    -- 2) UPDATE para won — espalhar won_at entre 2026-04-26 e 2026-05-01
    FOR v_seq IN 1..20 LOOP
      v_won_id := v_won_ids[v_seq];
      v_won_at_base := timestamptz '2026-04-26 12:00:00+00'
                       + make_interval(hours => v_seq * 7);  -- 7h * 20 = 140h ≈ 5,8 dias

      UPDATE public.leads
      SET status = 'won',
          won_at = v_won_at_base,
          lifecycle_stage = 'customer',
          close_probability = 5,
          last_interaction_at = v_won_at_base,
          updated_at = v_won_at_base
      WHERE id = v_won_id;

      -- Histórico de mudança em leads_updates (1 por lead won)
      INSERT INTO public.leads_updates (lead_id, user_id, notes, created_at)
      VALUES (
        v_won_id,
        v_owner_id,
        'Status: in_progress → won. [DEMO_SEED_2026-05-02]',
        v_won_at_base
      );
    END LOOP;
  END IF;

  -- 3) Reforço dos 5 leads lost — caso algum esteja sem leads_loss_reasons_id
  FOR v_lost_id IN
    SELECT id
    FROM public.leads
    WHERE description LIKE '%[DEMO_SEED_2026-05-02]%'
      AND user_id = v_owner_id
      AND status = 'lost'
      AND leads_loss_reasons_id IS NULL
  LOOP
    SELECT id INTO v_loss_reason
    FROM public.leads_loss_reasons
    WHERE name IN ('Preço','Concorrência','Sem budget','Timing ruim')
    ORDER BY random()
    LIMIT 1;

    UPDATE public.leads
    SET leads_loss_reasons_id = v_loss_reason,
        lost_at = COALESCE(lost_at, v_now - interval '4 days'),
        loss_reason = (SELECT name FROM public.leads_loss_reasons WHERE id = v_loss_reason),
        updated_at = v_now
    WHERE id = v_lost_id;
  END LOOP;

  -- 4) 10 notas de fechamento nos primeiros 10 leads won
  SELECT count(*) INTO v_existing_notes
  FROM public.leads_notes
  WHERE content LIKE '%[DEMO_SEED_2026-05-02]%'
    AND user_id = v_owner_id;

  IF v_existing_notes >= 10 THEN
    RAISE NOTICE '04_deals: já há % notas marker — INSERT de notas pulado', v_existing_notes;
  ELSE
    -- Selecionar os 10 primeiros leads won (cronologicamente)
    FOR v_seq IN 1..10 LOOP
      SELECT id INTO v_won_id
      FROM public.leads
      WHERE description LIKE '%[DEMO_SEED_2026-05-02]%'
        AND user_id = v_owner_id
        AND status = 'won'
      ORDER BY won_at, id
      LIMIT 1 OFFSET (v_seq - 1);

      IF v_won_id IS NOT NULL THEN
        INSERT INTO public.leads_notes (lead_id, user_id, title, content, created_at, updated_at)
        VALUES (
          v_won_id,
          v_owner_id,
          'Fechamento',
          v_won_notes[v_seq],
          v_now - make_interval(days => (10 - v_seq)),
          v_now - make_interval(days => (10 - v_seq))
        );
      END IF;
    END LOOP;
  END IF;

  RAISE NOTICE '04_deals: 20 leads → won, 5 leads lost reforço, 10 notas inseridas';
END $$;
