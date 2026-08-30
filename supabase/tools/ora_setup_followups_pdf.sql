-- =====================================================================
-- Arquivo:  ora_setup_followups_pdf.sql
-- Objetivo: FUPs de cadência + pós-agendamento conforme documento
--           "ORA - Script contato msg" (Erika Crivellari)
-- Versão:   2026-05-03 — mensagens exatas do PDF
-- Tenant:   xiucvgrwfleffqlozoad
-- Tabelas:  leads_stages_followups, meetings_followups
--           INSERT/UPDATE apenas — nenhum ALTER TABLE / CREATE TABLE
--
-- CADÊNCIA (leads_stages_followups)
--   Stage "Tentativa de Contato": b1c752e4-30ad-4d38-8ee1-335517347854
--   control: integer — 1=recomendacao | 2=pessoal | 3=evento | 4=network
--   Timing (8 dias, conforme diagrama PDF):
--     D0   → MSG 1
--     D+1  → MSG 2
--     D+2  → MSG 3  ⚠️ pessoal/evento/network = "???" no PDF → fallback
--     D+3  → MSG 4 + LIGAÇÃO (PDF Dia 4)
--     D+4  → LIGAÇÃO (PDF Dia 5)
--     D+5  → LIGAÇÃO (PDF Dia 6)
--     D+6  → LIGAÇÃO (PDF Dia 7)
--     D+7  → MSG 5 — encerramento (PDF Dia 8)
--
-- PÓS-AGENDAMENTO (meetings_followups)
--   meeting_status='agendado', source='channel', channel='whatsapp'
--   1. Imediato (D0)  → active=true
--   2. D-1 manhã      → active=false ⚠️ AGUARDA-FIX-TRIGGER
--   3. Link manhã D0  → active=false ⚠️ AGUARDA-FIX-TRIGGER
-- =====================================================================

-- ══════════════════════════════════════════════════════════════════════
-- SEÇÃO 1 — Cadência (leads_stages_followups)
-- ══════════════════════════════════════════════════════════════════════

DO $cadencia$
DECLARE
  v_stage uuid := 'b1c752e4-30ad-4d38-8ee1-335517347854'; -- Tentativa de Contato
  v_cnt   int;
BEGIN
  SELECT count(*) INTO v_cnt
  FROM public.leads_stages_followups
  WHERE leads_stages_id = v_stage
    AND control IN (1, 2, 3, 4);

  IF v_cnt > 0 THEN
    RAISE NOTICE '[fups_pdf Sec1] % FUPs já existem nessa stage — pulando.', v_cnt;
    RETURN;
  END IF;

  -- ─────────────────────────────────────────────────────────────────
  -- FLOW 1: RECOMENDAÇÃO (control = 1)
  -- ─────────────────────────────────────────────────────────────────

  -- D0 — MSG 1
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 1, 0, 0, 0,
    'Olá {{nome}}, sou eu Ora. Tudo Bem!? Estou te ligando a pedido do {{recomendante}}, {{relacao_recomendante}}. Tentei contato com você algumas vezes e não tive sucesso. Você está podendo falar um minutinho?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_rec_msg1';

  -- D+1 — MSG 2
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 1, 1, 0, 0,
    'Olá {{nome}}, Tudo Bem!? O {{recomendante}} te avisou que eu iria entrar em contato? Meu nome é ORA, faço parte do time da Erika Crivellari, ela é especialista em planejamento financeiro e seu amigo o {{recomendante}} fez um trabalho com ela e ficou bastante entusiasmado, ele acredita que seria muito importante você conhecer também. Será em torno de 30 minutinhos online. Pra você seria melhor no horário comercial ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_rec_msg2';

  -- D+2 — MSG 3
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 1, 2, 0, 0,
    'Olá {{nome}}, Tudo Bem!? Como seu amigo, {{recomendante}}, nos pediu para persistir neste encontro porque acredita na importância, e nos disse que seu tempo é valioso, a pedido dele vamos flexibilizar a agenda pra você. Qual melhor horário no horário comercial ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_rec_msg3';

  -- D+3 — MSG 4 (PDF Dia 4)
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 1, 3, 0, 0,
    'Olá {{nome}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. Como seu amigo, {{recomendante}}, não está pronto para desistir de você, eu também não, resolvi fazer mais uma tentativa. Qual melhor horário para te ligar, manha ou tarde?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_rec_msg4';

  -- D+3 — LIGAÇÃO (PDF Dia 4, após MSG)
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes, message, active, created_at, updated_at)
  VALUES (gen_random_uuid(), v_stage, 'ligacao', 1, 3, 1, 0,
    'Ligação D+3 — recomendação (PDF Dia 4)', true, NOW(), NOW());

  -- D+4, D+5, D+6 — LIGAÇÕES (PDF Dias 5, 6, 7)
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes, message, active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_stage, 'ligacao', 1, 4, 0, 0, 'Ligação D+4 — recomendação (PDF Dia 5)', true, NOW(), NOW()),
    (gen_random_uuid(), v_stage, 'ligacao', 1, 5, 0, 0, 'Ligação D+5 — recomendação (PDF Dia 6)', true, NOW(), NOW()),
    (gen_random_uuid(), v_stage, 'ligacao', 1, 6, 0, 0, 'Ligação D+6 — recomendação (PDF Dia 7)', true, NOW(), NOW());

  -- D+7 — MSG 5 — Encerramento (PDF Dia 8)
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 1, 7, 0, 0,
    'Boa tarde {{nome}}, Como não obtive um retorno de sua parte, estou encerrando meu contato por hora. Acredito que seu amigo, {{recomendante}}, quando te recomendou para essa oportunidade, realmente pensou o quanto seria importante pra você. Mas entendo o tempo, e o momento de cada um, e fico a disposição caso queira dar sequencia. Abraço e ótimo dia.',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_rec_msg5';

  -- ─────────────────────────────────────────────────────────────────
  -- FLOW 2: PESSOAL (control = 2)
  -- ─────────────────────────────────────────────────────────────────

  -- D0 — MSG 1
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 2, 0, 0, 0,
    'Olá {{nome}}, sou eu Ora. Tudo Bem!? Faço parte da equipe da Erika Crivellari, {{relacao_erika}}, ela me pediu que eu entrasse em contato com você pessoalmente. Tentei contato com você algumas vezes e não tive sucesso. Ela me pediu que agendasse um momento que vocês pudessem falar sobre negócios. Ela pediu que, no seu caso, eu flexibilizasse a agenda dela. Será por volta de 30 a 40 minutinhos! Como funcionam seus horários, é melhor pra você no horário comercial ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_pes_msg1_v2';

  -- D+1 — MSG 2
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 2, 1, 0, 0,
    'Olá {{nome}}, Tudo Bem!? Erika me pediu para persistir neste encontro porque acredita na importância dessa conversa, e nos disse que seu tempo é valioso, a pedido dela vou flexibilizar a agenda pra você. Qual melhor horário no horário comercial ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_pes_msg2';

  -- D+2 — MSG 3 (⚠️ não definida no PDF — usando template existente)
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 2, 2, 0, 0,
    'Olá {{nome}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. Como sua amiga, Erika, não está pronta para desistir de você eu também não, resolvi fazer mais uma tentativa. Qual melhor horário para essa agenda? Horário comercial ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_pes_msg3';

  -- D+3 — MSG 4
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 2, 3, 0, 0,
    'Olá {{nome}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. Como sua amiga, Erika, não está pronta para desistir de você eu também não, resolvi fazer mais uma tentativa. Qual melhor horário para essa agenda? Horário comercial ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_pes_msg4';

  -- D+3 — LIGAÇÃO
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes, message, active, created_at, updated_at)
  VALUES (gen_random_uuid(), v_stage, 'ligacao', 2, 3, 1, 0,
    'Ligação D+3 — pessoal (PDF Dia 4)', true, NOW(), NOW());

  -- D+4, D+5, D+6 — LIGAÇÕES
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes, message, active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_stage, 'ligacao', 2, 4, 0, 0, 'Ligação D+4 — pessoal (PDF Dia 5)', true, NOW(), NOW()),
    (gen_random_uuid(), v_stage, 'ligacao', 2, 5, 0, 0, 'Ligação D+5 — pessoal (PDF Dia 6)', true, NOW(), NOW()),
    (gen_random_uuid(), v_stage, 'ligacao', 2, 6, 0, 0, 'Ligação D+6 — pessoal (PDF Dia 7)', true, NOW(), NOW());

  -- D+7 — MSG 5 — Encerramento
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 2, 7, 0, 0,
    'Boa tarde {{nome}}, Como não obtive um retorno de sua parte, a pedido da Erika Crivellari, estou encerrando nosso contato por hora. Mas entendemos o tempo, e o momento de cada um, e nos colocamos a disposição caso tenha interesse. Abraço e ótimo dia.',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_pes_msg5';

  -- ─────────────────────────────────────────────────────────────────
  -- FLOW 3: EVENTO / CAMPANHAS (control = 3)
  -- ─────────────────────────────────────────────────────────────────

  -- D0 — MSG 1
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 3, 0, 0, 0,
    'Olá {{nome}}, sou eu Ora. Tudo Bem!? Faço parte da equipe da Erika Crivellari, e estou entrando em contato pela sua participação no {{nome_evento}}. Tentei contato com você algumas vezes e não tive sucesso. Erika gostaria de um encontro com você e me pediu para flexibilizar a agenda dela pra você. Será em torno de 30 minutinhos online. O que fica melhor pra você horário comercial ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_evt_msg1';

  -- D+1 — MSG 2
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 3, 1, 0, 0,
    'Olá {{nome}}, Tudo Bem!? Vamos agendar esse encontro? O que fica melhor pra você horário comercial ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_evt_msg2';

  -- D+2 — MSG 3 (⚠️ não definida no PDF — usando template existente)
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 3, 2, 0, 0,
    'Olá {{nome}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. A Erika está animada para esse encontro e não está pronta para desistir de você. Qual melhor horário para te ligar? Hoje, a tarde ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_evt_msg3';

  -- D+3 — MSG 4
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 3, 3, 0, 0,
    'Olá {{nome}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. Como não estou pronta para desistir de você, resolvi fazer mais uma tentativa. Qual melhor horário para te ligar? Hoje, a tarde ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_evt_msg4';

  -- D+3 — LIGAÇÃO
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes, message, active, created_at, updated_at)
  VALUES (gen_random_uuid(), v_stage, 'ligacao', 3, 3, 1, 0,
    'Ligação D+3 — evento (PDF Dia 4)', true, NOW(), NOW());

  -- D+4, D+5, D+6 — LIGAÇÕES
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes, message, active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_stage, 'ligacao', 3, 4, 0, 0, 'Ligação D+4 — evento (PDF Dia 5)', true, NOW(), NOW()),
    (gen_random_uuid(), v_stage, 'ligacao', 3, 5, 0, 0, 'Ligação D+5 — evento (PDF Dia 6)', true, NOW(), NOW()),
    (gen_random_uuid(), v_stage, 'ligacao', 3, 6, 0, 0, 'Ligação D+6 — evento (PDF Dia 7)', true, NOW(), NOW());

  -- D+7 — MSG 5 — Encerramento
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 3, 7, 0, 0,
    'Boa tarde {{nome}}, Como não obtive um retorno de sua parte, estou encerrando nosso contato por hora. Mas entendemos o tempo, e o momento de cada um, e nos colocamos a disposição caso tenha interesse. Abraço e ótimo dia.',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_evt_msg5';

  -- ─────────────────────────────────────────────────────────────────
  -- FLOW 4: NETWORK (control = 4)
  -- ─────────────────────────────────────────────────────────────────

  -- D0 — MSG 1
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 4, 0, 0, 0,
    'Olá {{nome}}, sou eu Ora. Tudo Bem!? Faço parte da equipe da Erika Crivellari, vocês se conheceram no {{nome_evento}}, ela me pediu que eu entrasse em contato com você pessoalmente. Tentei contato com você algumas vezes e não tive sucesso. Ela pediu que, no seu caso, eu flexibilizasse a agenda dela. Será por volta de 30 a 40 minutinhos! Como funcionam seus horários, é melhor pra você no horário comercial ou a noite? Te aguardo Obrigada',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_net_msg1';

  -- D+1 — MSG 2
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 4, 1, 0, 0,
    'Olá {{nome}}, Tudo Bem!? Vamos agendar esse encontro? O que fica melhor pra você horário comercial ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_net_msg2';

  -- D+2 — MSG 3 (⚠️ não definida no PDF — usando template existente)
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 4, 2, 0, 0,
    'Olá {{nome}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. A Erika não está pronta para desistir de você eu também não, resolvi fazer mais uma tentativa. Qual melhor horário para te ligar? Hoje, a tarde ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_net_msg3';

  -- D+3 — MSG 4
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 4, 3, 0, 0,
    'Olá {{nome}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. Como Erika, não está pronta para desistir de você eu também não, resolvi fazer mais uma tentativa. Qual melhor horário para te ligar? Hoje, a tarde ou a noite?',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_net_msg4';

  -- D+3 — LIGAÇÃO
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes, message, active, created_at, updated_at)
  VALUES (gen_random_uuid(), v_stage, 'ligacao', 4, 3, 1, 0,
    'Ligação D+3 — network (PDF Dia 4)', true, NOW(), NOW());

  -- D+4, D+5, D+6 — LIGAÇÕES
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes, message, active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_stage, 'ligacao', 4, 4, 0, 0, 'Ligação D+4 — network (PDF Dia 5)', true, NOW(), NOW()),
    (gen_random_uuid(), v_stage, 'ligacao', 4, 5, 0, 0, 'Ligação D+5 — network (PDF Dia 6)', true, NOW(), NOW()),
    (gen_random_uuid(), v_stage, 'ligacao', 4, 6, 0, 0, 'Ligação D+6 — network (PDF Dia 7)', true, NOW(), NOW());

  -- D+7 — MSG 5 — Encerramento
  INSERT INTO public.leads_stages_followups
    (id, leads_stages_id, type, control, days, hours, minutes,
     message, whatsapp_template_id, template_id, active, created_at, updated_at)
  SELECT gen_random_uuid(), v_stage, 'whatsapp_texto', 4, 7, 0, 0,
    'Boa tarde {{nome}}, Como não obtive um retorno de sua parte, a pedido da Erika Crivellari, estou encerrando nosso contato por hora. Mas entendemos o tempo, e o momento de cada um, e nos colocamos a disposição caso tenha interesse. Abraço e ótimo dia.',
    wt.id::text, wt.id::text, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_net_msg5';

  RAISE NOTICE '[fups_pdf Sec1] OK — FUPs de cadência inseridos: 4 flows × 9 entries = 36 registros.';
END;
$cadencia$;

-- ══════════════════════════════════════════════════════════════════════
-- SEÇÃO 2 — Pós-agendamento (meetings_followups)
--           meeting_status = 'agendado'
-- ══════════════════════════════════════════════════════════════════════

DO $posagend$
DECLARE
  v_cnt int;
BEGIN
  SELECT count(*) INTO v_cnt
  FROM public.meetings_followups
  WHERE meeting_status = 'agendado'
    AND type = 'whatsapp_texto'
    AND source = 'channel';

  IF v_cnt > 0 THEN
    RAISE NOTICE '[fups_pdf Sec2] % FUPs pós-agendamento já existem — pulando.', v_cnt;
    RETURN;
  END IF;

  -- 1. Confirmação imediata — enviada logo após o agendamento
  --    active=true: trigger calcula scheduled_for = now() + 0 → dispara imediato ✅
  INSERT INTO public.meetings_followups (
    id, name, meeting_status, type, channel, source,
    days, hours, minutes, message,
    whatsapp_template_id, webhook_url, active, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    'ORA — Confirmação imediata pós-agendamento',
    'agendado', 'whatsapp_texto', 'whatsapp', 'channel',
    0, 0, 0,
    'Olá {{nome}}, sou eu Ora. Segue o contato pessoal da Erika Crivellari e a confirmação do encontro de vocês. Será {{data_reuniao}} as {{hora_reuniao}}. Te envio o link por aqui no dia combinado. Tenho certeza que será incrível esse café virtual com ela. Ótimo dia',
    wt.id, NULL, true, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_agend_confirmacao';

  -- 2. Lembrete 1 dia antes (manhã)
  --    ⚠️ active=false — trigger atual não suporta timing relativo a meeting.start_time.
  --    days=-1 resultaria em scheduled_for retroativo. Habilitar após fix do trigger.
  INSERT INTO public.meetings_followups (
    id, name, meeting_status, type, channel, source,
    days, hours, minutes, message,
    whatsapp_template_id, webhook_url, active, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    'ORA — Lembrete D-1 9h ⚠️ AGUARDA-FIX-TRIGGER',
    'agendado', 'whatsapp_texto', 'whatsapp', 'channel',
    -1, 9, 0,
    'Bom dia {{nome}}. Tudo bem? Amanhã seu encontro com a Erika Crivellari está confirmado, ela está animada para esta conversa. Antes da reunião você receberá o link da sala. Ótimo dia',
    wt.id, NULL, false, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_agend_lembrete';

  -- 3. Link no dia do encontro (manhã, algumas horas antes)
  --    ⚠️ active=false — mesma limitação. Habilitar após fix do trigger.
  INSERT INTO public.meetings_followups (
    id, name, meeting_status, type, channel, source,
    days, hours, minutes, message,
    whatsapp_template_id, webhook_url, active, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    'ORA — Link dia D manhã ⚠️ AGUARDA-FIX-TRIGGER',
    'agendado', 'whatsapp_texto', 'whatsapp', 'channel',
    0, 8, 0,
    'Bom dia {{nome}}. Segue o link do seu encontro com a Erika Crivellari: {{link_reuniao}}. Até daqui a pouco',
    wt.id, NULL, false, NOW(), NOW()
  FROM public.whatsapp_templates wt WHERE wt.meta_template_name = 'ora_agend_link';

  RAISE NOTICE '[fups_pdf Sec2] OK — 3 FUPs pós-agendamento inseridos (1 ativo, 2 aguardando fix do trigger).';
END;
$posagend$;

-- ══════════════════════════════════════════════════════════════════════
-- RESUMO ESPERADO
--   [fups_pdf Sec1] OK — FUPs de cadência inseridos: 4 flows × 9 entries = 36 registros.
--   [fups_pdf Sec2] OK — 3 FUPs pós-agendamento inseridos (1 ativo, 2 aguardando fix).
-- ══════════════════════════════════════════════════════════════════════
