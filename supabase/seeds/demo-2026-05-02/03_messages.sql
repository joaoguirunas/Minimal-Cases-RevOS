-- =====================================================================
-- Arquivo:  03_messages.sql
-- Time:     ora-sim-dados-apresentacao
-- Tabelas:  messages
-- Volumes:  ~210 mensagens (7 por lead × 30 leads)
-- Depende:  02_people_leads.sql (pessoas + leads existem com marker)
-- Marker:   [DEMO_SEED_2026-05-02] em metadata.demo_seed
--
-- Padrão de conversa por lead:
--   - 3 cliente (inbound) + 3 humano (outbound) = 6
--   - +1 agente_ia (outbound) em 40% dos leads
-- channel='whatsapp', message_type='texto'.
-- status='read' se sent_at < (NOW - 2d) senão 'delivered'.
-- id é bigserial — NÃO inserir.
-- =====================================================================

DO $$
DECLARE
  v_owner_id     uuid;
  v_lead         record;
  v_existing     int;
  v_now          timestamptz := timestamptz '2026-05-02 18:00:00+00';
  v_two_days_ago timestamptz := v_now - interval '2 days';

  v_msg_idx      int;
  v_total_msgs   int := 0;
  v_lead_count   int := 0;

  v_msg_offset   interval;  -- offset relativo ao created_at do lead
  v_sent_at      timestamptz;
  v_status       text;
  v_from         text;
  v_user         uuid;
  v_content      text;
  v_use_ai       boolean;
  v_lead_seq     int := 0;

  -- Frases de cliente (inbound) — pt-BR B2B
  v_client_lines text[] := ARRAY[
    'Olá, vi o material de vocês e fiquei interessado em entender melhor a solução.',
    'Quanto custa pra um time de 5 vendedores?',
    'Vocês têm integração com o nosso CRM atual?',
    'Faz sentido. Podemos agendar uma demo na próxima semana?',
    'Confirmado, recebi o link. Vou entrar pelo Meet.',
    'Estou avaliando 2 opções, posso te dar um retorno até sexta?',
    'Perfeito, manda a proposta por email que apresento internamente.',
    'Recebido. Tenho algumas dúvidas sobre o módulo de disparo.'
  ];

  -- Frases de humano (outbound)
  v_human_lines text[] := ARRAY[
    'Olá! Tudo bem? Recebemos seu contato e fico feliz em apresentar a ORA.',
    'Posso te chamar agora rapidamente pra entender melhor seu cenário?',
    'Sim, integramos via API e webhooks com os principais CRMs do mercado.',
    'Claro, te mando 3 horários. Qual funciona melhor: terça 10h, quarta 14h ou quinta 16h?',
    'Agendado pra quarta às 14h. Te encaminho o link do Meet.',
    'Sem problemas, fico no aguardo. Qualquer dúvida me chama.',
    'Te mandei a proposta agora. Qualquer ajuste me avisa.',
    'Combinado. Sucesso na apresentação interna!'
  ];

  -- Frases de agente IA (outbound)
  v_ai_lines text[] := ARRAY[
    'Oi! Sou o assistente da ORA. Posso te ajudar a entender as funcionalidades antes de chamar um consultor?',
    'Anotei suas preferências. Vou conectar com o time comercial pra continuidade.',
    'Lembrete: sua reunião está marcada para amanhã. Qualquer alteração me avise.'
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

  -- Idempotência: já tem messages com marker?
  SELECT count(*) INTO v_existing
  FROM public.messages
  WHERE metadata->>'demo_seed' = '2026-05-02';

  IF v_existing > 0 THEN
    RAISE NOTICE '03_messages: já há % messages com marker — pulando', v_existing;
    RETURN;
  END IF;

  -- Loop pelos leads do seed (descritos via marker)
  FOR v_lead IN
    SELECT l.id AS lead_id, l.people_id, l.created_at
    FROM public.leads l
    WHERE l.description LIKE '%[DEMO_SEED_2026-05-02]%'
      AND l.user_id = v_owner_id
    ORDER BY l.created_at, l.id
  LOOP
    v_lead_seq := v_lead_seq + 1;
    v_lead_count := v_lead_count + 1;

    -- 40% dos leads recebem +1 mensagem do agente IA
    v_use_ai := (v_lead_seq % 5) IN (1, 3);  -- ~40% determinístico

    -- 6 mensagens base: cli, hum, cli, hum, cli, hum (alternadas)
    FOR v_msg_idx IN 1..6 LOOP
      -- Offsets crescentes pra criar timeline na conversa
      v_msg_offset := make_interval(hours => v_msg_idx * 4);
      v_sent_at := v_lead.created_at + v_msg_offset;

      -- Status: 'read' se antiga, 'delivered' se recente
      IF v_sent_at < v_two_days_ago THEN
        v_status := 'read';
      ELSE
        v_status := 'delivered';
      END IF;

      -- Alternar from_contact: ímpar = cliente, par = humano
      IF v_msg_idx % 2 = 1 THEN
        v_from := 'cliente';
        v_user := NULL;
        v_content := v_client_lines[((v_msg_idx + v_lead_seq) % array_length(v_client_lines, 1)) + 1];
      ELSE
        v_from := 'humano';
        v_user := v_owner_id;
        v_content := v_human_lines[((v_msg_idx + v_lead_seq) % array_length(v_human_lines, 1)) + 1];
      END IF;

      INSERT INTO public.messages (
        content, channel, message_type, from_contact, status,
        lead_id, people_id, user_id,
        sent_at, delivered_at, read_at,
        wa_phone_number_id, metadata,
        created_at, updated_at
      )
      VALUES (
        v_content,
        'whatsapp',
        'texto',
        v_from,
        v_status,
        v_lead.lead_id,
        v_lead.people_id,
        v_user,
        v_sent_at,
        CASE WHEN v_from <> 'cliente' THEN v_sent_at + interval '3 seconds' ELSE v_sent_at END,
        CASE WHEN v_status = 'read' THEN v_sent_at + interval '20 minutes' ELSE NULL END,
        NULL,
        jsonb_build_object('demo_seed', '2026-05-02'),
        v_sent_at,
        v_sent_at
      );

      v_total_msgs := v_total_msgs + 1;
    END LOOP;

    -- Mensagem extra do agente IA (40% dos leads)
    IF v_use_ai THEN
      v_msg_offset := interval '26 hours';
      v_sent_at := v_lead.created_at + v_msg_offset;
      v_status := CASE WHEN v_sent_at < v_two_days_ago THEN 'read' ELSE 'delivered' END;

      INSERT INTO public.messages (
        content, channel, message_type, from_contact, status,
        lead_id, people_id, user_id,
        sent_at, delivered_at, read_at,
        wa_phone_number_id, metadata,
        created_at, updated_at
      )
      VALUES (
        v_ai_lines[(v_lead_seq % array_length(v_ai_lines, 1)) + 1],
        'whatsapp',
        'texto',
        'agente_ia',
        v_status,
        v_lead.lead_id,
        v_lead.people_id,
        v_owner_id,
        v_sent_at,
        v_sent_at + interval '2 seconds',
        CASE WHEN v_status = 'read' THEN v_sent_at + interval '15 minutes' ELSE NULL END,
        NULL,
        jsonb_build_object('demo_seed', '2026-05-02', 'sent_by', 'agente_ia'),
        v_sent_at,
        v_sent_at
      );

      v_total_msgs := v_total_msgs + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '03_messages: % mensagens em % leads', v_total_msgs, v_lead_count;
END $$;
