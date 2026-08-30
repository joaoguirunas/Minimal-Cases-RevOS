-- =====================================================================
-- Arquivo:  11_ora_text_agents_fups.sql
-- Objetivo: Configurar FUPs de cadência (4 flows × 5 mensagens) e FUPs
--           pós-agendamento conforme documento "ORA - Script contato msg"
--           da Erika Crivellari (planejamento financeiro).
-- Tabelas:  leads_stages_followups, meetings_followups
--           + UPDATE pontual em ai_agents (use_stages do agente Agendado)
-- Idempotente: usa DO $$ ... RAISE NOTICE pulando se já houver dados
-- Tenant: xiucvgrwfleffqlozoad (single-tenant)
-- Owner:  outreachrelationship@gmail.com
--
-- ATENÇÃO — schema é SOMENTE LEITURA: este script só faz INSERT/UPDATE.
--           Nenhum ALTER TABLE / CREATE TABLE / DROP.
-- =====================================================================
--
-- CONTEXTO (gap analysis dev-analyst — 2026-05-02):
--   - Os 2 agentes ORA texto (4906fcb7… e d2f197a2…) JÁ existem no DB
--     com identidade Erika, 13 objeções e tools nativas. NÃO recriamos.
--   - leads_stages_followups e meetings_followups estão VAZIAS para
--     o tenant ORA — todos os FUPs precisam ser inseridos do zero.
--
-- DECISÕES DE DESIGN:
--   1. Stage onde rodam os 4 flows: "Tentativa de Contato"
--      (b1c752e4-30ad-4d38-8ee1-335517347854) — etapa onde o lead foi
--      importado e o time precisa fazer follow-up cego (sem resposta).
--   2. Filtro por origem do lead via leads_stages_followups.control:
--      'recomendacao' | 'pessoal' | 'evento' | 'network'.
--      O campo lead.control deve ser preenchido na importação.
--   3. type:
--        - 'whatsapp_texto' → mensagens livres pelo canal direto
--        - 'ligacao'        → tentativa de ligação registrada (D4)
--   4. Variáveis interpoladas pelo worker no envio:
--        {{nome}}, {{recomendante}}, {{nome_evento}},
--        {{data_reuniao}}, {{hora_reuniao}}, {{link_reuniao}}
--   5. meetings_followups.source = 'channel' (dispatch direto WA),
--      channel = 'whatsapp'.
--
-- ISSUE CONHECIDA (meetings_followups — timing relativo à start_time):
--   O trigger handle_meeting_followup_queue (versão vigente 2026-04-27)
--   calcula scheduled_for = now() + (days*86400 + hours*3600 + minutes*60).
--   Logo:
--     • days=0, hours=0       → dispara imediato após agendamento ✅
--     • days=-1               → scheduled_for no PASSADO → dispara
--                               imediato (NÃO é "1 dia antes da reunião") ⚠️
--     • dia D pela manhã      → trigger não tem suporte; depende de
--                               cron externo ou fix futuro do trigger.
--   Os 3 FUPs ficam INSERIDOS conforme documento, mas os 2 que dependem
--   de start_time entram com active=false e marcador no campo `name`
--   ("⚠️ AGUARDA-FIX-TRIGGER"). O gestor habilita quando o trigger for
--   atualizado para suportar timing relativo a NEW.start_time.
-- =====================================================================

-- ══════════════════════════════════════════════════════════════════════
-- SEÇÃO 1 — Cadência de FUPs (leads_stages_followups)
--           4 flows × 5 mensagens = 20 registros
-- ══════════════════════════════════════════════════════════════════════

DO $sec1$
DECLARE
  v_stage_tentativa  uuid := 'b1c752e4-30ad-4d38-8ee1-335517347854';
  v_existing         int;
BEGIN
  -- Idempotência: se já houver fups com control nesse stage, pula tudo.
  SELECT count(*) INTO v_existing
  FROM public.leads_stages_followups
  WHERE leads_stages_id = v_stage_tentativa
    AND control IN ('recomendacao','pessoal','evento','network');

  IF v_existing > 0 THEN
    RAISE NOTICE '[11_ora_fups Sec1] % FUPs de cadência já existentes — pulando seção 1.', v_existing;
    RETURN;
  END IF;

  -- ── FLOW 1: RECOMENDAÇÃO ─────────────────────────────────────────────
  -- D1 (D=0): primeiro contato citando recomendante
  INSERT INTO public.leads_stages_followups (
    id, leads_stages_id, type, control,
    days, hours, minutes,
    message, subject, template_id, audio_file,
    active, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'recomendacao',
    0, 0, 0,
    'Olá {{nome}}, sou eu Ora. Tudo Bem!? Estou te ligando a pedido do {{recomendante}}. Tentei contato com você algumas vezes e não tive sucesso. Você está podendo falar um minutinho?',
    NULL, NULL, NULL,
    true, NOW(), NOW()
  );

  -- D2 (D+2): retomada
  INSERT INTO public.leads_stages_followups (
    id, leads_stages_id, type, control,
    days, hours, minutes,
    message, subject, template_id, audio_file,
    active, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'recomendacao',
    2, 0, 0,
    'Olá {{nome}}, Tudo Bem!? O {{recomendante}} te avisou que eu iria entrar em contato? Estou aqui para agendar um café virtual de 20 minutinhos com a Erika Crivellari, especialista em planejamento financeiro. Qual o melhor horário pra você, no horário comercial ou a noite?',
    NULL, NULL, NULL,
    true, NOW(), NOW()
  );

  -- D3 (D+4): insistência leve
  INSERT INTO public.leads_stages_followups (
    id, leads_stages_id, type, control,
    days, hours, minutes,
    message, subject, template_id, audio_file,
    active, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'recomendacao',
    4, 0, 0,
    'Olá {{nome}}, Tudo Bem!? A Erika me pediu para insistir mais uma vez — esse encontro pode ser muito valioso pra você. Posso flexibilizar a agenda dela. Qual o melhor horário, comercial ou a noite?',
    NULL, NULL, NULL,
    true, NOW(), NOW()
  );

  -- D4 (D+6) — mensagem WhatsApp
  INSERT INTO public.leads_stages_followups (
    id, leads_stages_id, type, control,
    days, hours, minutes,
    message, subject, template_id, audio_file,
    active, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'recomendacao',
    6, 0, 0,
    'Olá {{nome}}, sou eu Ora novamente. Já tentei contato algumas vezes e não consegui falar com você. A Erika Crivellari abriu uma janela exclusiva na agenda dela pra você esta semana. Manhã, tarde ou noite, o que fica melhor pra você?',
    NULL, NULL, NULL,
    true, NOW(), NOW()
  );

  -- D4 (D+6) — tentativa de ligação extra
  INSERT INTO public.leads_stages_followups (
    id, leads_stages_id, type, control,
    days, hours, minutes,
    message, subject, template_id, audio_file,
    active, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_stage_tentativa, 'ligacao', 'recomendacao',
    6, 1, 0,
    'Tentativa de ligação D+6 (recomendação) — corretor toma nota.',
    NULL, NULL, NULL,
    true, NOW(), NOW()
  );

  -- D8 (D+8): encerramento gentil
  INSERT INTO public.leads_stages_followups (
    id, leads_stages_id, type, control,
    days, hours, minutes,
    message, subject, template_id, audio_file,
    active, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'recomendacao',
    8, 0, 0,
    'Olá {{nome}}, percebi que não consegui falar com você. Vou encerrar minhas tentativas por aqui, mas sempre que você quiser conversar com a Erika é só me chamar. Um grande abraço!',
    NULL, NULL, NULL,
    true, NOW(), NOW()
  );

  -- ── FLOW 2: PESSOAL ──────────────────────────────────────────────────
  INSERT INTO public.leads_stages_followups (id, leads_stages_id, type, control, days, hours, minutes, message, subject, template_id, audio_file, active, created_at, updated_at) VALUES
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'pessoal', 0, 0, 0,
   'Olá {{nome}}, sou eu Ora, da equipe da Erika Crivellari. Tudo bem!? A Erika me pediu para entrar em contato pessoalmente com você, ela gostaria muito de te conhecer melhor. Qual o melhor horário pra um café virtual de 20 minutinhos, comercial ou a noite?',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'pessoal', 2, 0, 0,
   'Olá {{nome}}, Tudo Bem!? Reforçando o convite da Erika — ela tem muito interesse em te conhecer e trocar uma ideia sobre planejamento financeiro. O que fica melhor, manhã, tarde ou noite?',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'pessoal', 4, 0, 0,
   'Olá {{nome}}, Tudo Bem!? A Erika me pediu para insistir mais uma vez — ela acredita muito nessa conversa. Posso flexibilizar a agenda dela pra você. Qual horário fica melhor, manhã, tarde ou noite?',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'pessoal', 6, 0, 0,
   'Olá {{nome}}, sou eu Ora novamente. Antes de encerrar minhas tentativas, queria te dar uma última oportunidade — a Erika tem horários abertos esta semana. Manhã, tarde ou noite, o que prefere?',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'ligacao', 'pessoal', 6, 1, 0,
   'Tentativa de ligação D+6 (pessoal) — corretor toma nota.',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'pessoal', 8, 0, 0,
   'Olá {{nome}}, percebi que não consegui falar com você. Vou encerrar minhas tentativas por aqui, mas sempre que você quiser conversar com a Erika é só me chamar. Um grande abraço!',
   NULL, NULL, NULL, true, NOW(), NOW());

  -- ── FLOW 3: EVENTO ───────────────────────────────────────────────────
  INSERT INTO public.leads_stages_followups (id, leads_stages_id, type, control, days, hours, minutes, message, subject, template_id, audio_file, active, created_at, updated_at) VALUES
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'evento', 0, 0, 0,
   'Olá {{nome}}, sou eu Ora. Tudo Bem!? Te identifiquei como participante do {{nome_evento}} e a Erika Crivellari, especialista em planejamento financeiro, gostaria muito de te conhecer melhor. Qual o melhor horário pra um café virtual de 20 minutinhos, comercial ou a noite?',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'evento', 2, 0, 0,
   'Olá {{nome}}, Tudo Bem!? Como você participou do {{nome_evento}}, queria reforçar o convite da Erika para esse café virtual. O que fica melhor pra você, manhã, tarde ou noite?',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'evento', 4, 0, 0,
   'Olá {{nome}}, Tudo Bem!? Como você participou do {{nome_evento}}, a Erika gostaria muito de te conhecer melhor. Vamos agendar esse encontro? Manhã, tarde ou noite, o que fica melhor?',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'evento', 6, 0, 0,
   'Olá {{nome}}, sou eu Ora novamente. Como você esteve no {{nome_evento}}, abrimos uma janela exclusiva na agenda da Erika pra você esta semana. Manhã, tarde ou noite, o que prefere?',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'ligacao', 'evento', 6, 1, 0,
   'Tentativa de ligação D+6 (evento) — corretor toma nota.',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'evento', 8, 0, 0,
   'Olá {{nome}}, percebi que não consegui falar com você desde o {{nome_evento}}. Vou encerrar minhas tentativas por aqui, mas sempre que você quiser conversar com a Erika é só me chamar. Um grande abraço!',
   NULL, NULL, NULL, true, NOW(), NOW());

  -- ── FLOW 4: NETWORK ──────────────────────────────────────────────────
  INSERT INTO public.leads_stages_followups (id, leads_stages_id, type, control, days, hours, minutes, message, subject, template_id, audio_file, active, created_at, updated_at) VALUES
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'network', 0, 0, 0,
   'Olá {{nome}}, sou eu Ora, da equipe da Erika Crivellari. Tudo Bem!? Vocês se conheceram recentemente e a Erika gostaria de dar continuidade à conversa de vocês com um café virtual de 20 minutinhos. Qual o melhor horário, comercial ou a noite?',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'network', 2, 0, 0,
   'Olá {{nome}}, Tudo Bem!? Reforçando o convite da Erika — ela gostou muito do contato de vocês e quer aprofundar a conversa. O que fica melhor pra você, manhã, tarde ou noite?',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'network', 4, 0, 0,
   'Olá {{nome}}, Tudo Bem!? Vocês se conheceram no evento e a Erika me pediu para flexibilizar a agenda dela pra você. Qual horário fica melhor, manhã, tarde ou noite?',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'network', 6, 0, 0,
   'Olá {{nome}}, sou eu Ora novamente. A Erika abriu uma janela exclusiva na agenda dela pra você esta semana. Manhã, tarde ou noite, o que prefere?',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'ligacao', 'network', 6, 1, 0,
   'Tentativa de ligação D+6 (network) — corretor toma nota.',
   NULL, NULL, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), v_stage_tentativa, 'whatsapp_texto', 'network', 8, 0, 0,
   'Olá {{nome}}, percebi que não consegui falar com você. Vou encerrar minhas tentativas por aqui, mas sempre que você quiser conversar com a Erika é só me chamar. Um grande abraço!',
   NULL, NULL, NULL, true, NOW(), NOW());

  RAISE NOTICE '[11_ora_fups Sec1] OK — 24 FUPs inseridos (4 flows × 6 entries: 5 WA + 1 ligacao). Stage: %', v_stage_tentativa;
END;
$sec1$;

-- ══════════════════════════════════════════════════════════════════════
-- SEÇÃO 2 — FUPs pós-agendamento (meetings_followups)
--           3 registros, todos meeting_status='agendado'
-- ══════════════════════════════════════════════════════════════════════

DO $sec2$
DECLARE
  v_existing int;
BEGIN
  -- Idempotência: se já houver fups WA texto agendados, pula seção
  SELECT count(*) INTO v_existing
  FROM public.meetings_followups
  WHERE meeting_status = 'agendado'
    AND type = 'whatsapp_texto'
    AND source = 'channel';

  IF v_existing > 0 THEN
    RAISE NOTICE '[11_ora_fups Sec2] % FUPs pós-agendamento já existentes — pulando seção 2.', v_existing;
    RETURN;
  END IF;

  -- 1. IMEDIATO após agendamento (days=0/h=0/m=0)
  --    Trigger atual: scheduled_for = now() → dispara imediato. ✅ FUNCIONA
  INSERT INTO public.meetings_followups (
    id, name, meeting_status, type, channel, source,
    days, hours, minutes,
    message, subject, template_id, audio_file,
    webhook_url, active, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    'ORA — Confirmação imediata pós-agendamento',
    'agendado', 'whatsapp_texto', 'whatsapp', 'channel',
    0, 0, 0,
    'Olá {{nome}}, sou eu Ora. Segue o contato pessoal da Erika Crivellari e a confirmação do encontro de vocês. Será dia {{data_reuniao}} as {{hora_reuniao}}. Te envio o link por aqui no dia combinado. Tenho certeza que será incrível esse café virtual com ela. Ótimo dia',
    NULL, NULL, NULL,
    NULL, true, NOW(), NOW()
  );

  -- 2. 1 DIA ANTES da reunião (D-1, 9h)
  --    ⚠️ Trigger atual NÃO suporta timing relativo a meeting.start_time.
  --    days=-1 resultaria em scheduled_for retroativo → dispara imediato.
  --    Inserido com active=false até trigger ser corrigido para usar
  --    NEW.start_time como base quando days<0 (vide migration 20260326110000
  --    que já tinha esse comportamento e foi sobrescrita pela FWUP-07).
  INSERT INTO public.meetings_followups (
    id, name, meeting_status, type, channel, source,
    days, hours, minutes,
    message, subject, template_id, audio_file,
    webhook_url, active, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    'ORA — Lembrete D-1 9h ⚠️ AGUARDA-FIX-TRIGGER',
    'agendado', 'whatsapp_texto', 'whatsapp', 'channel',
    -1, 9, 0,
    'Bom dia {{nome}}. Tudo bem? Amanhã seu encontro com a Erika Crivellari está confirmado, ela está animada para esta conversa. Antes da reunião você receberá o link da sala. Ótimo dia',
    NULL, NULL, NULL,
    NULL, false, NOW(), NOW()
  );

  -- 3. DIA DA REUNIÃO pela manhã (D0, 8h)
  --    ⚠️ Mesma limitação: precisaria disparar relativo ao start_time
  --    da reunião (manhã do mesmo dia), não relativo ao agendamento.
  --    Inserido com active=false aguardando fix do trigger.
  INSERT INTO public.meetings_followups (
    id, name, meeting_status, type, channel, source,
    days, hours, minutes,
    message, subject, template_id, audio_file,
    webhook_url, active, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    'ORA — Link dia D 8h ⚠️ AGUARDA-FIX-TRIGGER',
    'agendado', 'whatsapp_texto', 'whatsapp', 'channel',
    0, 8, 0,
    'Bom dia {{nome}}. Segue o link do seu encontro com a Erika Crivellari: {{link_reuniao}}. Até daqui a pouco',
    NULL, NULL, NULL,
    NULL, false, NOW(), NOW()
  );

  RAISE NOTICE '[11_ora_fups Sec2] OK — 3 FUPs pós-agendamento inseridos (1 ativo, 2 inativos aguardando fix do trigger).';
END;
$sec2$;

-- ══════════════════════════════════════════════════════════════════════
-- SEÇÃO 3 — UPDATE pontual: corrigir use_stages do agente "ORA — Agendado"
--           (tem 4 stage_ids configurados mas use_stages=false)
-- ══════════════════════════════════════════════════════════════════════

DO $sec3$
DECLARE
  v_agent_id    uuid := 'd2f197a2-4491-4d08-81f7-976ea2bb0283';
  v_use_stages  boolean;
BEGIN
  SELECT use_stages INTO v_use_stages
  FROM public.ai_agents
  WHERE id = v_agent_id;

  IF NOT FOUND THEN
    RAISE NOTICE '[11_ora_fups Sec3] Agente ORA — Agendado (%) NÃO encontrado — pulando.', v_agent_id;
    RETURN;
  END IF;

  IF v_use_stages = true THEN
    RAISE NOTICE '[11_ora_fups Sec3] use_stages já = true em % — pulando.', v_agent_id;
    RETURN;
  END IF;

  UPDATE public.ai_agents
  SET use_stages = true,
      updated_at = NOW()
  WHERE id = v_agent_id;

  RAISE NOTICE '[11_ora_fups Sec3] OK — use_stages corrigido para true em ORA — Agendado (%).', v_agent_id;
END;
$sec3$;

-- ══════════════════════════════════════════════════════════════════════
-- FIM — Resumo esperado do log:
--   [11_ora_fups Sec1] OK — 24 FUPs inseridos ...
--   [11_ora_fups Sec2] OK — 3 FUPs pós-agendamento inseridos ...
--   [11_ora_fups Sec3] OK — use_stages corrigido ...
-- ══════════════════════════════════════════════════════════════════════
