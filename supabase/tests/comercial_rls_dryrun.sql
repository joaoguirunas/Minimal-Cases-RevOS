-- Dry-run: aplicar a migration + estas asserções em UMA transação e dar ROLLBACK no final.
-- Qualquer RAISE EXCEPTION aborta → a migration não sobe. Rodar pelo controlador (Management API):
--   BEGIN;  <20260909100000_comercial_recuperacao.sql sem o COMMIT final>  <este arquivo>  ROLLBACK;
-- Nada persiste. O JWT é simulado com set_config('request.jwt.claims', …, true) +
-- set_config('role', 'authenticated', true) — o equivalente de SET LOCAL ROLE authenticated.
DO $$
DECLARE
  v_pipe uuid; v_stage_ca uuid; v_stage_rec uuid; v_stage_neg uuid;
  v_admin_auth uuid := gen_random_uuid(); v_c1_auth uuid := gen_random_uuid(); v_c2_auth uuid := gen_random_uuid();
  v_c1 uuid; v_c2 uuid; v_p1 uuid; v_p2 uuid; v_p3 uuid;
  v_pool uuid; v_recente uuid; v_outro_rec uuid; v_validacao uuid;
  v_n integer; v_res jsonb;
BEGIN
  SELECT id INTO v_pipe FROM public.leads_pipelines WHERE name = 'Esteira Minimal — Loja';
  SELECT id INTO v_stage_ca  FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Carrinho abandonado';
  SELECT id INTO v_stage_rec FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Recuperado';
  SELECT id INTO v_stage_neg FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Em negociação';
  IF v_stage_neg IS NULL THEN RAISE EXCEPTION 'stage Em negociação não criado'; END IF;
  IF (SELECT order_index FROM public.leads_stages WHERE id = v_stage_neg) <> 3 THEN RAISE EXCEPTION 'order_index de Em negociação deveria ser 3'; END IF;
  IF (SELECT order_index FROM public.leads_stages WHERE id = v_stage_rec) <> 6 THEN RAISE EXCEPTION 'Recuperado deveria ter sido reindexado para 6'; END IF;

  INSERT INTO auth.users (id, email) VALUES (v_c1_auth, 'dry-c1@test.local'), (v_c2_auth, 'dry-c2@test.local');
  INSERT INTO public.settings_users (auth_user_id, name, email, user_type, active)
    VALUES (v_c1_auth, 'C1', 'dry-c1@test.local', 'comercial', true) RETURNING id INTO v_c1;
  INSERT INTO public.settings_users (auth_user_id, name, email, user_type, active)
    VALUES (v_c2_auth, 'C2', 'dry-c2@test.local', 'comercial', true) RETURNING id INTO v_c2;

  INSERT INTO public.clients_people (name, email) VALUES ('Pool', 'pool@t.local') RETURNING id INTO v_p1;
  INSERT INTO public.clients_people (name, email) VALUES ('Recente', 'rec@t.local') RETURNING id INTO v_p2;
  INSERT INTO public.clients_people (name, email) VALUES ('Outro', 'outro@t.local') RETURNING id INTO v_p3;

  INSERT INTO public.leads (title, people_id, leads_pipelines_id, leads_stages_id, status, created_at)
    VALUES ('pool', v_p1, v_pipe, v_stage_ca, 'in_progress', now() - interval '16 days') RETURNING id INTO v_pool;
  INSERT INTO public.leads (title, people_id, leads_pipelines_id, leads_stages_id, status, created_at)
    VALUES ('recente', v_p2, v_pipe, v_stage_ca, 'in_progress', now() - interval '14 days') RETURNING id INTO v_recente;
  INSERT INTO public.leads (title, people_id, leads_pipelines_id, leads_stages_id, status, created_at, user_id)
    VALUES ('rec de outro', v_p3, v_pipe, v_stage_rec, 'won', now() - interval '30 days', v_c2) RETURNING id INTO v_outro_rec;
  INSERT INTO public.leads (title, people_id, leads_pipelines_id, leads_stages_id, status, created_at)
    SELECT 'validacao', v_p1, p.id, s.id, 'in_progress', now() - interval '30 days'
      FROM public.leads_pipelines p JOIN public.leads_stages s ON s.leads_pipelines_id = p.id AND s.name = 'Carrinho abandonado'
     WHERE p.name = 'Esteira Validação' LIMIT 1 RETURNING id INTO v_validacao;

  -- ── como C1 ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c1_auth, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  IF NOT public.is_commercial() THEN RAISE EXCEPTION 'C1 deveria ser comercial'; END IF;

  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_pool;      IF v_n <> 1 THEN RAISE EXCEPTION 'C1 deveria ver o lead do pool'; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_recente;   IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver lead com 14d'; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_outro_rec; IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver Recuperado de C2'; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_validacao; IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver pipeline Validação'; END IF;
  SELECT count(*) INTO v_n FROM public.clients_people WHERE id = v_p2; IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver pessoa de lead invisível'; END IF;
  SELECT count(*) INTO v_n FROM public.omni_channel_configs;        IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver omni_channel_configs'; END IF;
  SELECT count(*) INTO v_n FROM public.leads_pipelines;             IF v_n <> 1 THEN RAISE EXCEPTION 'C1 deveria ver exatamente 1 pipeline (Loja), viu %', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.settings_users;              IF v_n <> 1 THEN RAISE EXCEPTION 'C1 deveria ver só a própria linha'; END IF;

  v_res := public.claim_lead(v_pool);
  IF (v_res->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'claim de C1 deveria dar ok: %', v_res; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_pool AND user_id = v_c1 AND leads_stages_id = v_stage_neg AND claimed_at IS NOT NULL;
  IF v_n <> 1 THEN RAISE EXCEPTION 'lead assumido deveria estar em Em negociação com dono C1'; END IF;
  v_res := public.claim_lead(v_recente);
  IF v_res->>'reason' <> 'fora_do_pool' THEN RAISE EXCEPTION 'claim de lead recente deveria ser fora_do_pool: %', v_res; END IF;

  -- ── como C2 ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c2_auth, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_pool;      IF v_n <> 0 THEN RAISE EXCEPTION 'C2 NÃO deveria ver lead assumido por C1'; END IF;
  v_res := public.claim_lead(v_pool);
  IF v_res->>'reason' <> 'ja_assumido' THEN RAISE EXCEPTION 'C2 deveria receber ja_assumido: %', v_res; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_outro_rec; IF v_n <> 1 THEN RAISE EXCEPTION 'C2 deveria ver o próprio Recuperado'; END IF;

  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
  RAISE NOTICE 'DRY-RUN OK';
END $$;
