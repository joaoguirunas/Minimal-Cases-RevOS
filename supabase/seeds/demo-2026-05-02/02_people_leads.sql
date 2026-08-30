-- =====================================================================
-- Arquivo:  02_people_leads.sql
-- Time:     ora-sim-dados-apresentacao
-- Tabelas:  clients_people, leads
-- Volumes:  20 pessoas + 30 leads
-- Depende:  01_config_base.sql (settings_users existe)
-- Marker:   [DEMO_SEED_2026-05-02]
--
-- Distribuição de status no INSERT:
--   - 25 leads 'in_progress'  (20 viram 'won' no 04, 5 ficam ativos)
--   - 5  leads 'lost'         (já entram como lost — atualização opcional no 04)
--
-- Idempotência: anti-duplicação por nome de pessoa + marker em description.
-- =====================================================================

DO $$
DECLARE
  v_owner_id     uuid;
  v_pipeline_id  uuid;
  v_stage_0_id   uuid;
  v_stage_1_id   uuid;
  v_stage_2_id   uuid;
  v_stage_3_id   uuid;
  v_stage_4_id   uuid;
  v_stage_5_id   uuid;

  v_people_ids   uuid[] := ARRAY[]::uuid[];
  v_pid          uuid;
  v_existing_count int;

  -- Dados base de pessoas (20 nomes brasileiros plausíveis)
  v_names        text[] := ARRAY[
    'Ana Beatriz Costa',     'Bruno Henrique Lima',   'Carolina Souza Reis',
    'Diego Martins Almeida', 'Eduarda Ferreira Pinto','Fábio Ribeiro Nunes',
    'Gabriela Castro Melo',  'Henrique Oliveira Sá',  'Isabela Moura Andrade',
    'João Pedro Cardoso',    'Karen Alves Tavares',   'Leonardo Borges Vieira',
    'Mariana Duarte Cunha',  'Nicolas Rocha Barbosa', 'Olívia Pereira Mendes',
    'Paulo Roberto Siqueira','Queren Lopes Silveira', 'Renata Cavalcanti Faria',
    'Sérgio Macedo Brito',   'Tatiana Nogueira Pires'
  ];

  v_phones text[] := ARRAY[
    '+5511988770001','+5511988770002','+5511988770003','+5511988770004','+5511988770005',
    '+5511988770006','+5511988770007','+5511988770008','+5511988770009','+5511988770010',
    '+5511988770011','+5511988770012','+5511988770013','+5511988770014','+5511988770015',
    '+5511988770016','+5511988770017','+5511988770018','+5511988770019','+5511988770020'
  ];

  v_emails text[] := ARRAY[
    'ana.costa@demo.local','bruno.lima@demo.local','carolina.reis@demo.local',
    'diego.almeida@demo.local','eduarda.pinto@demo.local','fabio.nunes@demo.local',
    'gabriela.melo@demo.local','henrique.sa@demo.local','isabela.andrade@demo.local',
    'joao.cardoso@demo.local','karen.tavares@demo.local','leonardo.vieira@demo.local',
    'mariana.cunha@demo.local','nicolas.barbosa@demo.local','olivia.mendes@demo.local',
    'paulo.siqueira@demo.local','queren.silveira@demo.local','renata.faria@demo.local',
    'sergio.brito@demo.local','tatiana.pires@demo.local'
  ];

  v_sources text[] := ARRAY[
    'instagram','meta_ads','google_ads','indicacao','lista',
    'meta_ads','google_ads','instagram','indicacao','meta_ads',
    'google_ads','lista','meta_ads','indicacao','instagram',
    'google_ads','meta_ads','instagram','lista','meta_ads'
  ];

  -- 30 leads: distribuição por status inicial e por stage
  v_lead_status     text[] := ARRAY[
    'in_progress','in_progress','in_progress','in_progress','in_progress',
    'in_progress','in_progress','in_progress','in_progress','in_progress',
    'in_progress','in_progress','in_progress','in_progress','in_progress',
    'in_progress','in_progress','in_progress','in_progress','in_progress',
    'in_progress','in_progress','in_progress','in_progress','in_progress',
    'lost','lost','lost','lost','lost'
  ];

  v_lead_lifecycle  text[] := ARRAY[
    'lead','mql','sql','opportunity','mql','sql','opportunity','lead','mql','sql',
    'opportunity','mql','sql','opportunity','lead','mql','sql','opportunity','mql','sql',
    'opportunity','mql','sql','opportunity','mql','lead','mql','sql','lead','mql'
  ];

  -- people index (1..20) para cada um dos 30 leads — alguns repetem (lead duplo)
  v_people_idx int[] := ARRAY[
    1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
    1,3,5,7,9,
    2,4,6,8,10
  ];

  -- 30 stages cíclicos (0..5)
  v_stage_idx int[] := ARRAY[
    0,1,2,3,4,5,0,1,2,3,
    4,5,0,1,2,3,4,5,0,1,
    2,3,4,5,0,
    1,2,3,4,5
  ];

  v_lead_sources text[] := ARRAY[
    'instagram','meta_ads','google_ads','indicacao','lista','meta_ads','google_ads','instagram','indicacao','meta_ads',
    'google_ads','lista','meta_ads','indicacao','instagram','google_ads','meta_ads','instagram','lista','meta_ads',
    'meta_ads','google_ads','indicacao','meta_ads','instagram',
    'google_ads','lista','meta_ads','indicacao','instagram'
  ];

  -- 12 leads com utm_campaign preenchido (ligação ao BI), 18 NULL
  v_utm_campaign text[] := ARRAY[
    'meta_lead_gen', NULL, 'google_brand', NULL, NULL, 'meta_remarketing', 'google_pmax', NULL, NULL, 'meta_lead_gen',
    'google_pmax', NULL, 'meta_lead_gen', NULL, NULL, 'google_brand', 'meta_remarketing', NULL, NULL, 'meta_remarketing',
    NULL, 'google_pmax', NULL, 'meta_lead_gen', NULL,
    NULL, NULL, 'meta_remarketing', NULL, NULL
  ];

  v_utm_source text[] := ARRAY[
    'facebook',NULL,'google',NULL,NULL,'facebook','google',NULL,NULL,'facebook',
    'google',NULL,'facebook',NULL,NULL,'google','facebook',NULL,NULL,'facebook',
    NULL,'google',NULL,'facebook',NULL,
    NULL,NULL,'facebook',NULL,NULL
  ];

  -- Valores e datas (created_at) ao longo da janela 2026-04-23 → 2026-05-02
  v_values     numeric[] := ARRAY[
    2500,3000,4500,6000,2200,5500,7800,2800,3500,4900,
    6500,3200,7100,4200,2700,8000,5100,3900,2400,6700,
    7400,3300,5800,4400,2900,
    2100,2800,3700,4100,2600
  ];

  -- Offsets em dias para created_at (0 = hoje 2026-05-02; ate 9 dias atrás)
  v_days_back  int[] := ARRAY[
    0,1,1,2,2,3,3,4,4,5,
    5,6,6,7,7,8,8,9,9,9,
    1,2,3,4,5,
    6,7,8,9,9
  ];

  v_now timestamptz := timestamptz '2026-05-02 18:00:00+00';

  v_lead_id uuid;
  i int;
BEGIN
  -- Owner
  SELECT id INTO v_owner_id
  FROM public.settings_users
  WHERE email = 'outreachrelationship@gmail.com'
  LIMIT 1;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner não encontrado — rodar 01_config_base.sql primeiro';
  END IF;

  -- Pipeline ativo
  SELECT id INTO v_pipeline_id
  FROM public.leads_pipelines
  WHERE active = true
  ORDER BY order_index, created_at
  LIMIT 1;
  IF v_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum pipeline ativo encontrado em leads_pipelines';
  END IF;

  -- Stages 0..5 (em ordem)
  SELECT id INTO v_stage_0_id FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline_id ORDER BY order_index, created_at LIMIT 1 OFFSET 0;
  SELECT id INTO v_stage_1_id FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline_id ORDER BY order_index, created_at LIMIT 1 OFFSET 1;
  SELECT id INTO v_stage_2_id FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline_id ORDER BY order_index, created_at LIMIT 1 OFFSET 2;
  SELECT id INTO v_stage_3_id FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline_id ORDER BY order_index, created_at LIMIT 1 OFFSET 3;
  SELECT id INTO v_stage_4_id FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline_id ORDER BY order_index, created_at LIMIT 1 OFFSET 4;
  SELECT id INTO v_stage_5_id FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline_id ORDER BY order_index, created_at LIMIT 1 OFFSET 5;

  IF v_stage_0_id IS NULL OR v_stage_1_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline ativo precisa ter pelo menos 2 stages — abortando';
  END IF;

  -- Idempotência: se já existem >= 20 pessoas com email demo.local OU se já há lead com marker,
  -- abortar este lote (não duplicar).
  SELECT count(*) INTO v_existing_count
  FROM public.leads
  WHERE description LIKE '%[DEMO_SEED_2026-05-02]%'
    AND user_id = v_owner_id;

  IF v_existing_count > 0 THEN
    RAISE NOTICE 'Lote 02 já aplicado anteriormente (% leads marker encontrados) — pulando', v_existing_count;
    RETURN;
  END IF;

  -- 1) Inserir 20 pessoas e armazenar UUIDs em ordem
  FOR i IN 1..20 LOOP
    INSERT INTO public.clients_people (
      name, email, whatsapp, telefone, status, source, accepts_calls, ai_enabled,
      notes, created_at, updated_at
    )
    VALUES (
      v_names[i],
      v_emails[i],
      v_phones[i],
      v_phones[i],
      'active',
      v_sources[i],
      true,
      false,
      'Pessoa demo — ' || v_sources[i] || '. [DEMO_SEED_2026-05-02]',
      v_now - make_interval(days => v_days_back[i]),
      v_now - make_interval(days => v_days_back[i])
    )
    RETURNING id INTO v_pid;

    v_people_ids := array_append(v_people_ids, v_pid);
  END LOOP;

  -- 2) Inserir 30 leads (cada lead referencia uma das 20 pessoas)
  FOR i IN 1..30 LOOP
    INSERT INTO public.leads (
      status, people_id, leads_pipelines_id, leads_stages_id, user_id,
      lifecycle_stage, lead_source, utm_source, utm_campaign,
      title, description, value, close_probability, pre_sale_temperature,
      last_interaction_at, created_at, updated_at,
      lost_at, leads_loss_reasons_id
    )
    VALUES (
      v_lead_status[i],
      v_people_ids[v_people_idx[i]],
      v_pipeline_id,
      CASE v_stage_idx[i]
        WHEN 0 THEN v_stage_0_id
        WHEN 1 THEN v_stage_1_id
        WHEN 2 THEN COALESCE(v_stage_2_id, v_stage_1_id)
        WHEN 3 THEN COALESCE(v_stage_3_id, v_stage_1_id)
        WHEN 4 THEN COALESCE(v_stage_4_id, v_stage_1_id)
        WHEN 5 THEN COALESCE(v_stage_5_id, v_stage_1_id)
      END,
      v_owner_id,
      v_lead_lifecycle[i],
      v_lead_sources[i],
      v_utm_source[i],
      v_utm_campaign[i],
      'Oportunidade — ' || v_names[v_people_idx[i]],
      'Lead demo seed. [DEMO_SEED_2026-05-02]',
      v_values[i],
      CASE v_lead_lifecycle[i]
        WHEN 'lead' THEN 1
        WHEN 'mql' THEN 2
        WHEN 'sql' THEN 3
        WHEN 'opportunity' THEN 4
        ELSE 2
      END,
      CASE v_lead_lifecycle[i]
        WHEN 'lead' THEN 1
        WHEN 'mql' THEN 2
        WHEN 'sql' THEN 3
        WHEN 'opportunity' THEN 4
        ELSE 1
      END,
      v_now - make_interval(days => v_days_back[i]) + interval '2 hours',
      v_now - make_interval(days => v_days_back[i]),
      v_now - make_interval(days => v_days_back[i]),
      -- Para leads que já entram como 'lost' (índices 26..30), preencher lost_at
      CASE WHEN v_lead_status[i] = 'lost'
           THEN v_now - make_interval(days => v_days_back[i]) + interval '1 day'
           ELSE NULL
      END,
      -- leads_loss_reasons_id: NULL aqui; será populado no 04 OR já agora se 'lost'
      CASE WHEN v_lead_status[i] = 'lost'
           THEN (SELECT id FROM public.leads_loss_reasons
                 WHERE name IN ('Preço','Concorrência','Sem budget','Timing ruim')
                 ORDER BY random() LIMIT 1)
           ELSE NULL
      END
    );
  END LOOP;

  RAISE NOTICE '02_people_leads: 20 pessoas + 30 leads inseridos (owner=%, pipeline=%)',
               v_owner_id, v_pipeline_id;
END $$;
