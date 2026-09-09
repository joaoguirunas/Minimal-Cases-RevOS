-- Dry-run: aplicar a migration + estas asserções em UMA transação e dar ROLLBACK no final.
-- Qualquer RAISE EXCEPTION aborta → a migration não sobe. Rodar pelo controlador (Management API):
--   BEGIN;  <20260909100000_comercial_recuperacao.sql sem o COMMIT final>  <este arquivo>  ROLLBACK;
-- Nada persiste. O JWT é simulado com set_config('request.jwt.claims', …, true) +
-- set_config('role', 'authenticated', true) — o equivalente de SET LOCAL ROLE authenticated.
--
-- Cobre três personas: COMERCIAL (C1/C2 — vê só o pool e o que é dele, nada de segredo),
-- e ADMIN (continua vendo tudo — a §5a não pode ter estreitado o acesso de quem não é comercial).
DO $$
DECLARE
  v_pipe uuid; v_stage_ca uuid; v_stage_rec uuid; v_stage_neg uuid;
  v_admin_auth uuid := gen_random_uuid(); v_c1_auth uuid := gen_random_uuid(); v_c2_auth uuid := gen_random_uuid();
  v_admin uuid; v_c1 uuid; v_c2 uuid; v_p1 uuid; v_p2 uuid; v_p3 uuid;
  v_pool uuid; v_recente uuid; v_outro_rec uuid; v_validacao uuid; v_tag uuid;
  v_n integer; v_res jsonb;
  -- contagens tiradas como postgres (sem RLS), para comparar com o que cada persona vê
  v_all_leads integer; v_all_people integer;
  v_sec_omni integer; v_sec_wa integer; v_sec_keys integer; v_sec_ai integer;
BEGIN
  SELECT id INTO v_pipe FROM public.leads_pipelines WHERE name = 'Esteira Minimal — Loja';
  IF v_pipe IS NULL THEN RAISE EXCEPTION 'pipeline "Esteira Minimal — Loja" não encontrado'; END IF;
  SELECT id INTO v_stage_ca  FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Carrinho abandonado';
  SELECT id INTO v_stage_rec FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Recuperado';
  SELECT id INTO v_stage_neg FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Em negociação';
  IF v_stage_neg IS NULL THEN RAISE EXCEPTION 'stage Em negociação não criado'; END IF;
  IF (SELECT order_index FROM public.leads_stages WHERE id = v_stage_neg) <> 3 THEN RAISE EXCEPTION 'order_index de Em negociação deveria ser 3'; END IF;
  IF (SELECT order_index FROM public.leads_stages WHERE id = v_stage_rec) <> 6 THEN RAISE EXCEPTION 'Recuperado deveria ter sido reindexado para 6'; END IF;
  -- M3: sem o pipeline de validação a asserção "comercial não vê outro pipeline" seria vazia
  IF NOT EXISTS (SELECT 1 FROM public.leads_pipelines WHERE name = 'Esteira Validação') THEN
    RAISE EXCEPTION 'pipeline "Esteira Validação" não encontrado — a asserção de isolamento entre pipelines ficaria vazia';
  END IF;

  INSERT INTO auth.users (id, email) VALUES
    (v_c1_auth, 'dry-c1@test.local'), (v_c2_auth, 'dry-c2@test.local'), (v_admin_auth, 'dry-adm@test.local');
  INSERT INTO public.settings_users (auth_user_id, name, email, user_type, active)
    VALUES (v_c1_auth, 'C1', 'dry-c1@test.local', 'comercial', true) RETURNING id INTO v_c1;
  INSERT INTO public.settings_users (auth_user_id, name, email, user_type, active)
    VALUES (v_c2_auth, 'C2', 'dry-c2@test.local', 'comercial', true) RETURNING id INTO v_c2;
  INSERT INTO public.settings_users (auth_user_id, name, email, user_type, active, super_admin)
    VALUES (v_admin_auth, 'ADM', 'dry-adm@test.local', 'admin', true, true) RETURNING id INTO v_admin;

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
  IF v_validacao IS NULL THEN RAISE EXCEPTION 'não consegui semear o lead do pipeline Esteira Validação'; END IF;

  -- Linhas que pertencem a OUTRA pessoa / OUTRO comercial: o C1 não pode ver nenhuma delas.
  INSERT INTO public.messages (content, people_id, lead_id, user_id)
    VALUES ('msg do outro', v_p3, v_outro_rec, v_c2);
  -- nomes de PRODUÇÃO: pessoa_id→person_id, canal→channel, scheduled_at→scheduled_for (20260427)
  INSERT INTO public.followup_queue (lead_id, person_id, channel, scheduled_for)
    VALUES (v_outro_rec, v_p3, 'email', now());
  INSERT INTO public.tracked_links (token, destination, people_id, lead_id, created_by)
    VALUES ('dry-tok-outro', 'https://example.test/x', v_p3, v_outro_rec, v_c2);
  INSERT INTO public.crm_coupons (code, source, people_id, lead_id, percent, created_by)
    VALUES ('DRYOUTRO10', 'comercial', v_p3, v_outro_rec, 10, v_c2);
  INSERT INTO public.esteira_reconversions (order_id, people_id, lead_id, order_total, paid_at, recovered_by, recovery_basis)
    VALUES ('dry-order-outro', v_p3, v_outro_rec, 199.90, now(), v_c2, 'cupom');
  -- Notificação e tag de uma pessoa/lead INVISÍVEL para o C1, mais a tag pessoal do C1
  INSERT INTO public.notifications (event_type, people_id, lead_id, title)
    VALUES ('inbound_message', v_p3, v_outro_rec, 'preview de conversa de terceiro');
  INSERT INTO public.lead_tags (name, color) VALUES ('dry-tag', '#111') RETURNING id INTO v_tag;
  INSERT INTO public.leads_tags (lead_id, tag_id) VALUES (v_outro_rec, v_tag);
  -- Allowlist: template que o comercial PRECISA continuar lendo
  INSERT INTO public.email_templates (name, subject, html_body)
    VALUES ('dry-run-tpl', 'assunto', '<p>x</p>');

  SELECT count(*) INTO v_all_leads  FROM public.leads;
  SELECT count(*) INTO v_all_people FROM public.clients_people;
  SELECT count(*) INTO v_sec_omni FROM public.omni_channel_configs;
  SELECT count(*) INTO v_sec_wa   FROM public.settings_whatsapp_channels;
  SELECT count(*) INTO v_sec_keys FROM public.tenant_api_keys;
  SELECT count(*) INTO v_sec_ai   FROM public.settings_ai_providers;
  IF v_sec_omni + v_sec_wa + v_sec_keys + v_sec_ai = 0 THEN
    RAISE EXCEPTION 'as 4 tabelas com credencial estão vazias — a asserção de vazamento não testaria nada';
  END IF;

  -- ── como C1 (comercial) ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c1_auth, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  IF NOT public.is_commercial() THEN RAISE EXCEPTION 'C1 deveria ser comercial'; END IF;

  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_pool;      IF v_n <> 1 THEN RAISE EXCEPTION 'C1 deveria ver o lead do pool'; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_recente;   IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver lead com 14d'; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_outro_rec; IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver Recuperado de C2'; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_validacao; IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver pipeline Validação'; END IF;
  SELECT count(*) INTO v_n FROM public.clients_people WHERE id = v_p2; IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver pessoa de lead invisível'; END IF;
  SELECT count(*) INTO v_n FROM public.leads_pipelines;             IF v_n <> 1 THEN RAISE EXCEPTION 'C1 deveria ver exatamente 1 pipeline (Loja), viu %', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.settings_users;              IF v_n <> 1 THEN RAISE EXCEPTION 'C1 deveria ver só a própria linha, viu %', v_n; END IF;

  -- tabelas com credencial: NADA (C1 do review — omni_channel_configs.credentials etc.)
  SELECT count(*) INTO v_n FROM public.omni_channel_configs;        IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver omni_channel_configs (credentials!)'; END IF;
  SELECT count(*) INTO v_n FROM public.settings_whatsapp_channels;  IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver settings_whatsapp_channels (access_token!)'; END IF;
  SELECT count(*) INTO v_n FROM public.tenant_api_keys;             IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver tenant_api_keys (key_hash!)'; END IF;
  SELECT count(*) INTO v_n FROM public.settings_ai_providers;       IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver settings_ai_providers (api_key!)'; END IF;

  -- linhas de terceiros nas tabelas que o comercial usa
  SELECT count(*) INTO v_n FROM public.messages WHERE people_id = v_p3;              IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver mensagem de pessoa invisível'; END IF;
  SELECT count(*) INTO v_n FROM public.followup_queue WHERE lead_id = v_outro_rec;   IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver followup_queue de lead invisível'; END IF;
  SELECT count(*) INTO v_n FROM public.tracked_links WHERE token = 'dry-tok-outro';  IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver tracked_link de lead invisível'; END IF;
  SELECT count(*) INTO v_n FROM public.crm_coupons WHERE code = 'DRYOUTRO10';        IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver cupom de outro comercial'; END IF;
  SELECT count(*) INTO v_n FROM public.esteira_reconversions WHERE order_id = 'dry-order-outro'; IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver comissão de outro comercial'; END IF;

  SELECT count(*) INTO v_n FROM public.notifications WHERE people_id = v_p3;         IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver notificação (título/preview) de pessoa invisível'; END IF;
  SELECT count(*) INTO v_n FROM public.leads_tags WHERE lead_id = v_outro_rec;       IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver leads_tags de lead invisível'; END IF;

  -- allowlist continua legível (senão a UI do comercial quebra)
  SELECT count(*) INTO v_n FROM public.email_templates WHERE name = 'dry-run-tpl';   IF v_n <> 1 THEN RAISE EXCEPTION 'C1 DEVERIA ver email_templates (allowlist)'; END IF;
  SELECT count(*) INTO v_n FROM public.lead_tags WHERE id = v_tag;                   IF v_n <> 1 THEN RAISE EXCEPTION 'C1 DEVERIA ver lead_tags, o catálogo de tags (allowlist)'; END IF;

  v_res := public.claim_lead(v_pool);
  IF (v_res->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'claim de C1 deveria dar ok: %', v_res; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_pool AND user_id = v_c1 AND leads_stages_id = v_stage_neg AND claimed_at IS NOT NULL;
  IF v_n <> 1 THEN RAISE EXCEPTION 'lead assumido deveria estar em Em negociação com dono C1'; END IF;
  v_res := public.claim_lead(v_recente);
  IF v_res->>'reason' <> 'fora_do_pool' THEN RAISE EXCEPTION 'claim de lead recente deveria ser fora_do_pool: %', v_res; END IF;

  -- ── como C2 (outro comercial) ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c2_auth, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_pool;      IF v_n <> 0 THEN RAISE EXCEPTION 'C2 NÃO deveria ver lead assumido por C1'; END IF;
  v_res := public.claim_lead(v_pool);
  IF v_res->>'reason' <> 'ja_assumido' THEN RAISE EXCEPTION 'C2 deveria receber ja_assumido: %', v_res; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_outro_rec; IF v_n <> 1 THEN RAISE EXCEPTION 'C2 deveria ver o próprio Recuperado'; END IF;
  SELECT count(*) INTO v_n FROM public.crm_coupons WHERE code = 'DRYOUTRO10';        IF v_n <> 1 THEN RAISE EXCEPTION 'C2 deveria ver o próprio cupom'; END IF;
  SELECT count(*) INTO v_n FROM public.esteira_reconversions WHERE order_id = 'dry-order-outro'; IF v_n <> 1 THEN RAISE EXCEPTION 'C2 deveria ver a própria comissão'; END IF;
  -- o lado positivo das duas políticas novas: a pessoa/lead É visível para C2
  SELECT count(*) INTO v_n FROM public.notifications WHERE people_id = v_p3;         IF v_n <> 1 THEN RAISE EXCEPTION 'C2 deveria ver a notificação da pessoa do próprio lead'; END IF;
  SELECT count(*) INTO v_n FROM public.leads_tags WHERE lead_id = v_outro_rec;       IF v_n <> 1 THEN RAISE EXCEPTION 'C2 deveria ver a tag do próprio lead'; END IF;

  -- ── como ADMIN: a §5a não pode ter estreitado nada para quem não é comercial ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_auth, 'role', 'authenticated')::text, true);
  IF public.is_commercial() THEN RAISE EXCEPTION 'ADM não deveria ser comercial'; END IF;
  SELECT count(*) INTO v_n FROM public.leads;          IF v_n <> v_all_leads  THEN RAISE EXCEPTION 'ADM deveria ver os % leads, viu %', v_all_leads, v_n; END IF;
  SELECT count(*) INTO v_n FROM public.clients_people; IF v_n <> v_all_people THEN RAISE EXCEPTION 'ADM deveria ver as % pessoas, viu %', v_all_people, v_n; END IF;
  SELECT count(*) INTO v_n FROM public.omni_channel_configs;       IF v_n <> v_sec_omni THEN RAISE EXCEPTION 'ADM deveria ver omni_channel_configs (% linhas), viu %', v_sec_omni, v_n; END IF;
  SELECT count(*) INTO v_n FROM public.settings_ai_providers;      IF v_n <> v_sec_ai   THEN RAISE EXCEPTION 'ADM deveria ver settings_ai_providers (% linhas), viu %', v_sec_ai, v_n; END IF;
  SELECT count(*) INTO v_n FROM public.email_templates WHERE name = 'dry-run-tpl';  IF v_n <> 1 THEN RAISE EXCEPTION 'ADM deveria ver email_templates'; END IF;

  SET LOCAL ROLE NONE;
  PERFORM set_config('request.jwt.claims', '', true);
  RAISE NOTICE 'DRY-RUN OK';
END $$;
