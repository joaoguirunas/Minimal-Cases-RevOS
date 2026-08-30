-- =====================================================================
-- Arquivo:  08_coach_pro.sql
-- Tabelas:  meeting_playbook_assignments, meeting_records,
--           meeting_evaluations, evaluation_section_results,
--           evaluation_criteria_results
-- Volumes:  12 reuniões compareceu:
--             6 → 1ª Reunião (Corretor de Seguros)
--             6 → 2ª Reunião (Corretor de Seguros)
--           Por reunião: 1 assignment + 2 records + 1 evaluation
--                        + 7 section_results + 21 criteria_results
-- Depende:  05_meetings.sql + 09_erika_playbooks.sql
-- =====================================================================

DO $$
DECLARE
  v_meeting        RECORD;
  v_eval_id        uuid;
  v_score          numeric(4,2);
  v_verdict        text;
  v_risk           text;
  v_sentiment      text;
  v_idx            int := 0;
  v_playbook_id    uuid;

  -- Playbooks Erika
  v_pb_r1 uuid := '55555555-0001-0000-0000-000000000001';
  v_pb_r2 uuid := '55555555-0002-0000-0000-000000000001';

  -- Seções — 1ª Reunião
  v_r1_s1 uuid := '66666666-0101-0000-0000-000000000001';
  v_r1_s2 uuid := '66666666-0102-0000-0000-000000000001';
  v_r1_s3 uuid := '66666666-0103-0000-0000-000000000001';
  v_r1_s4 uuid := '66666666-0104-0000-0000-000000000001';
  v_r1_s5 uuid := '66666666-0105-0000-0000-000000000001';
  v_r1_s6 uuid := '66666666-0106-0000-0000-000000000001';
  v_r1_s7 uuid := '66666666-0107-0000-0000-000000000001';

  -- Seções — 2ª Reunião
  v_r2_s1 uuid := '66666666-0201-0000-0000-000000000001';
  v_r2_s2 uuid := '66666666-0202-0000-0000-000000000001';
  v_r2_s3 uuid := '66666666-0203-0000-0000-000000000001';
  v_r2_s4 uuid := '66666666-0204-0000-0000-000000000001';
  v_r2_s5 uuid := '66666666-0205-0000-0000-000000000001';
  v_r2_s6 uuid := '66666666-0206-0000-0000-000000000001';
  v_r2_s7 uuid := '66666666-0207-0000-0000-000000000001';

  -- Critérios — 1ª Reunião (3 por seção)
  v_r1_s1_c1 uuid := '77777777-0101-0001-0000-000000000001';
  v_r1_s1_c2 uuid := '77777777-0101-0002-0000-000000000001';
  v_r1_s1_c3 uuid := '77777777-0101-0003-0000-000000000001';
  v_r1_s2_c1 uuid := '77777777-0102-0001-0000-000000000001';
  v_r1_s2_c2 uuid := '77777777-0102-0002-0000-000000000001';
  v_r1_s2_c3 uuid := '77777777-0102-0003-0000-000000000001';
  v_r1_s3_c1 uuid := '77777777-0103-0001-0000-000000000001';
  v_r1_s3_c2 uuid := '77777777-0103-0002-0000-000000000001';
  v_r1_s3_c3 uuid := '77777777-0103-0003-0000-000000000001';
  v_r1_s4_c1 uuid := '77777777-0104-0001-0000-000000000001';
  v_r1_s4_c2 uuid := '77777777-0104-0002-0000-000000000001';
  v_r1_s4_c3 uuid := '77777777-0104-0003-0000-000000000001';
  v_r1_s5_c1 uuid := '77777777-0105-0001-0000-000000000001';
  v_r1_s5_c2 uuid := '77777777-0105-0002-0000-000000000001';
  v_r1_s5_c3 uuid := '77777777-0105-0003-0000-000000000001';
  v_r1_s6_c1 uuid := '77777777-0106-0001-0000-000000000001';
  v_r1_s6_c2 uuid := '77777777-0106-0002-0000-000000000001';
  v_r1_s6_c3 uuid := '77777777-0106-0003-0000-000000000001';
  v_r1_s7_c1 uuid := '77777777-0107-0001-0000-000000000001';
  v_r1_s7_c2 uuid := '77777777-0107-0002-0000-000000000001';
  v_r1_s7_c3 uuid := '77777777-0107-0003-0000-000000000001';

  -- Critérios — 2ª Reunião (3 por seção)
  v_r2_s1_c1 uuid := '77777777-0201-0001-0000-000000000001';
  v_r2_s1_c2 uuid := '77777777-0201-0002-0000-000000000001';
  v_r2_s1_c3 uuid := '77777777-0201-0003-0000-000000000001';
  v_r2_s2_c1 uuid := '77777777-0202-0001-0000-000000000001';
  v_r2_s2_c2 uuid := '77777777-0202-0002-0000-000000000001';
  v_r2_s2_c3 uuid := '77777777-0202-0003-0000-000000000001';
  v_r2_s3_c1 uuid := '77777777-0203-0001-0000-000000000001';
  v_r2_s3_c2 uuid := '77777777-0203-0002-0000-000000000001';
  v_r2_s3_c3 uuid := '77777777-0203-0003-0000-000000000001';
  v_r2_s4_c1 uuid := '77777777-0204-0001-0000-000000000001';
  v_r2_s4_c2 uuid := '77777777-0204-0002-0000-000000000001';
  v_r2_s4_c3 uuid := '77777777-0204-0003-0000-000000000001';
  v_r2_s5_c1 uuid := '77777777-0205-0001-0000-000000000001';
  v_r2_s5_c2 uuid := '77777777-0205-0002-0000-000000000001';
  v_r2_s5_c3 uuid := '77777777-0205-0003-0000-000000000001';
  v_r2_s6_c1 uuid := '77777777-0206-0001-0000-000000000001';
  v_r2_s6_c2 uuid := '77777777-0206-0002-0000-000000000001';
  v_r2_s6_c3 uuid := '77777777-0206-0003-0000-000000000001';
  v_r2_s7_c1 uuid := '77777777-0207-0001-0000-000000000001';
  v_r2_s7_c2 uuid := '77777777-0207-0002-0000-000000000001';
  v_r2_s7_c3 uuid := '77777777-0207-0003-0000-000000000001';

  -- Scores: índices 0-5 → 1ª Reunião, 6-11 → 2ª Reunião (escala 0-10)
  v_scores    numeric(4,2)[] := ARRAY[8.5, 7.0, 9.2, 6.6, 8.8, 7.4, 8.1, 9.5, 6.3, 8.7, 7.3, 9.0];
  v_talk_cons numeric[] := ARRAY[0.52,0.65,0.47,0.71,0.50,0.60,0.55,0.44,0.73,0.51,0.63,0.48];

  v_existing int;
BEGIN
  -- Idempotência
  SELECT count(*) INTO v_existing
  FROM meeting_playbook_assignments mpa
  JOIN meetings m ON m.id = mpa.meeting_id
  WHERE m.description LIKE '%DEMO_SEED_2026-05-02%';

  IF v_existing >= 12 THEN
    RAISE NOTICE '08_coach_pro: dados já existem (% assignments). Pulando.', v_existing;
    RETURN;
  END IF;

  FOR v_meeting IN
    SELECT m.id AS meeting_id, m.start_time, m.title
    FROM meetings m
    WHERE m.description LIKE '%DEMO_SEED_2026-05-02%'
      AND m.status = 'compareceu'
    ORDER BY m.start_time
    LIMIT 12
  LOOP
    v_score   := v_scores[v_idx + 1];
    v_verdict := CASE
      WHEN v_score >= 8.8 THEN 'excellent'
      WHEN v_score >= 7.2 THEN 'good'
      WHEN v_score >= 6.0 THEN 'needs_improvement'
      ELSE 'critical'
    END;
    v_risk := CASE
      WHEN v_score >= 8.5 THEN 'low'
      WHEN v_score >= 7.0 THEN 'medium'
      ELSE 'high'
    END;
    v_sentiment := CASE
      WHEN v_score >= 8.5 THEN 'positivo'
      WHEN v_score >= 7.0 THEN 'misto'
      ELSE 'neutro'
    END;

    -- Primeiros 6 → 1ª Reunião; últimos 6 → 2ª Reunião
    v_playbook_id := CASE WHEN v_idx < 6 THEN v_pb_r1 ELSE v_pb_r2 END;

    -- 1. Playbook assignment
    INSERT INTO meeting_playbook_assignments (meeting_id, playbook_id, assigned_at)
    VALUES (v_meeting.meeting_id, v_playbook_id, v_meeting.start_time - interval '1 hour')
    ON CONFLICT DO NOTHING;

    -- 2. Transcript
    INSERT INTO meeting_records (
      meeting_id, record_type, source, duration_seconds,
      title, content, content_format,
      ai_sentiment, ai_score,
      ai_key_topics, ai_next_steps, ai_objections,
      recorded_at
    ) VALUES (
      v_meeting.meeting_id,
      'transcript', 'tldv',
      2800 + (v_idx * 200),
      'Transcrição — ' || v_meeting.title,
      CASE WHEN v_idx < 6 THEN
        '[DEMO_SEED_2026-05-02] Corretor: Oi, tudo bem? Antes da gente começar, queria te conhecer um pouquinho melhor. Como você conhece a Erika? Cliente: Foi minha irmã que me indicou. Disseram que o trabalho dela é diferente. Corretor: Que legal! E o que você espera dessa conversa hoje? Cliente: Honestamente, nunca parei pra pensar em proteção financeira. Queria entender melhor. Corretor: Faz todo sentido. Deixa eu te contar um pouco sobre mim antes… [Pitch pessoal] Cliente: Gostei muito da abordagem, nada de produto logo de cara. Corretor: Agora, numa situação hipotética — se você não pudesse mais trabalhar, como ficaria a sua família? Cliente: [pausa longa] Nossa… nunca pensei nisso assim. Não estaria preparado. Corretor: Esse sentimento é importante. Vamos entender sua realidade. Me conta sobre sua estrutura familiar…'
      ELSE
        '[DEMO_SEED_2026-05-02] Corretor: Como foi sua semana? Da nossa última conversa pra hoje, o que passou pela sua cabeça? Cliente: Fiquei pensando bastante, conversei com minha esposa. Ela quer estar junto nessa decisão. Corretor: Ótimo que ela vai estar aqui. Antes de mostrar o planejamento, quero validar as informações que você me trouxe… Cliente: Sim, os dados estão corretos. Corretor: Aqui no gráfico vemos sua realidade atual — você está bem hoje. Agora deixa eu te mostrar esse outro cenário… Cliente: Nossa, assustador. Nunca vi dessa forma. Corretor: Com base em tudo isso, estruturei a seguinte solução personalizada para você… Faz sentido? Cliente: Faz sentido sim. Corretor: Vamos preencher a proposta então. Quando foi a última vez que você foi ao médico?'
      END,
      'text',
      v_sentiment, v_score,
      CASE WHEN v_idx < 6
        THEN ARRAY['conexão', 'levantamento', 'despertar de necessidade', 'agendamento']
        ELSE ARRAY['validação', 'gráficos', 'solução', 'fechamento', 'objeções']
      END,
      CASE WHEN v_idx < 6
        THEN ARRAY['Agendar 2ª reunião', 'Preparar planejamento personalizado', 'Confirmar presença do cônjuge']
        ELSE ARRAY['Enviar proposta para companhia', 'Acompanhar análise', 'Pedir recomendações']
      END,
      CASE WHEN v_idx < 6
        THEN ARRAY['Não conhece o produto', 'Nunca pensou em proteção']
        ELSE ARRAY['Preço', 'Quer consultar cônjuge', 'Prefere esperar']
      END,
      v_meeting.start_time
    );

    -- 3. AI Summary
    INSERT INTO meeting_records (
      meeting_id, record_type, source, duration_seconds,
      title, content, content_format,
      ai_sentiment, ai_score,
      ai_key_topics, ai_next_steps,
      recorded_at
    ) VALUES (
      v_meeting.meeting_id,
      'ai_summary', 'tldv',
      2800 + (v_idx * 200),
      'Resumo IA — ' || v_meeting.title,
      CASE WHEN v_idx < 6 THEN
        '[DEMO_SEED_2026-05-02] **Resumo — 1ª Reunião:** ' || CASE
          WHEN v_score >= 8.5 THEN 'Execução excelente do método Erika. Conexão genuína estabelecida, expectativa mapeada, linha da vida construída, dor verbalizada pelo cliente. Segunda reunião agendada com cônjuge.'
          WHEN v_score >= 7.2 THEN 'Boa execução geral. Conexão e credibilidade bem trabalhadas. Pontos de melhoria: mais silêncio após perguntas de implicação e pergunta de sentimento mais aberta.'
          ELSE 'Execução parcial. Conexão inicial adequada, mas etapa de despertar de necessidade superficial. Dor não verbalizada pelo cliente. Segunda reunião em risco.'
        END
      ELSE
        '[DEMO_SEED_2026-05-02] **Resumo — 2ª Reunião:** ' || CASE
          WHEN v_score >= 8.5 THEN 'Fechamento de alta qualidade. Leitura de cenário precisa, validação completa, gráficos com impacto emocional real. Proposta preenchida sem resistência. Recomendações coletadas.'
          WHEN v_score >= 7.2 THEN 'Bom fechamento com pontos de atenção. Apresentação da solução eficaz. Objeção de preço surgiu mas foi tratada com técnica do bumerangue. Proposta assinada.'
          ELSE 'Fechamento com dificuldades. Objeção não tratada adequadamente. Proposta incompleta. Follow-up necessário para consolidar.'
        END
      END,
      'markdown',
      v_sentiment, v_score,
      CASE WHEN v_idx < 6
        THEN ARRAY['1ª reunião', 'conexão', 'levantamento estratégico']
        ELSE ARRAY['2ª reunião', 'fechamento', 'proposta']
      END,
      CASE WHEN v_idx < 6
        THEN ARRAY['2ª reunião confirmada', 'Planejamento em 48h']
        ELSE ARRAY['Proposta enviada', 'Follow-up em 5 dias']
      END,
      v_meeting.start_time + interval '30 minutes'
    );

    -- 4. Evaluation
    v_eval_id := gen_random_uuid();
    INSERT INTO meeting_evaluations (
      id, meeting_id, playbook_id,
      evaluation_version, status, triggered_by,
      model_used, provider_used, prompt_version,
      overall_score, overall_verdict,
      talk_ratio_consultant, talk_ratio_client,
      questions_total, questions_open,
      monologue_longest_sec,
      competitors_mentioned,
      deal_risk,
      sentiment_arc,
      strengths, gaps, next_steps,
      coaching_script,
      follow_up_agenda,
      evaluated_at
    ) VALUES (
      v_eval_id, v_meeting.meeting_id, v_playbook_id,
      1, 'done', 'auto',
      'claude-sonnet-4-6', 'anthropic', 'v3.0',
      v_score, v_verdict,
      v_talk_cons[v_idx + 1],
      1.0 - v_talk_cons[v_idx + 1],
      7 + (v_idx % 4), 4 + (v_idx % 3),
      80 + (v_idx * 15),
      CASE WHEN v_idx % 4 = 0 THEN ARRAY['Concorrente X', 'Banco Y'] ELSE ARRAY[]::text[] END,
      v_risk,
      ('{"start": ' || GREATEST(0, v_score - 0.8) || ', "mid": ' || v_score || ', "end": ' || LEAST(10, v_score + 0.6) || '}')::jsonb,
      CASE WHEN v_idx < 6 THEN
        ARRAY['Conexão genuína', 'Expectativa mapeada', 'Dor verbalizada pelo cliente']
      ELSE
        ARRAY['Validação completa', 'Impacto emocional nos gráficos', 'Concordância tácita bem executada']
      END,
      CASE WHEN v_score < 8.0 THEN
        ARRAY['Aumentar uso do silêncio', 'Mais perguntas abertas', 'Reforçar linha da vida']
      ELSE
        ARRAY['Manter ritmo de perguntas']
      END,
      CASE WHEN v_idx < 6
        THEN ARRAY['Agendar 2ª reunião', 'Preparar planejamento com dados coletados']
        ELSE ARRAY['Acompanhar proposta na companhia', 'Pedir recomendações em 3 dias']
      END,
      CASE WHEN v_score < 7.5 THEN
        'Atenção: corretor falou ' || round(v_talk_cons[v_idx + 1] * 100) || '% do tempo — meta é <55%. Trabalhar escuta ativa e técnica do silêncio.'
      ELSE
        'Boa execução. Método Erika bem aplicado. Continuar com linha da vida e perguntas de implicação.'
      END,
      CASE WHEN v_idx < 6 THEN
        '2ª reunião: ' || (v_meeting.start_time::date + 7)::text || ' com cônjuge presente. Planejamento pronto.'
      ELSE
        'Follow-up em 5 dias. Verificar análise da companhia. Solicitar recomendações.'
      END,
      v_meeting.start_time + interval '45 minutes'
    );

    -- 5. Section results (7 seções)
    IF v_idx < 6 THEN
      -- 1ª Reunião
      INSERT INTO evaluation_section_results (evaluation_id, section_id, score, summary)
      VALUES
        (v_eval_id, v_r1_s1, LEAST(10, v_score + 0.4),
         CASE WHEN v_score >= 8.0 THEN 'Conexão genuína. Expectativa mapeada. Referência ao indicador usada.' ELSE 'Conexão superficial. Expectativa não explorada adequadamente.' END),
        (v_eval_id, v_r1_s2, LEAST(10, v_score + 0.2),
         CASE WHEN v_score >= 8.0 THEN 'Pitch humano e conciso. Cliente compartilhou sobre vida pessoal.' ELSE 'Pitch técnico demais. Pouca troca pessoal.' END),
        (v_eval_id, v_r1_s3, v_score,
         CASE WHEN v_score >= 8.0 THEN 'Material visual presente. Estrutura de trabalho clara.' ELSE 'Ausência de material. Credibilidade comprometida.' END),
        (v_eval_id, v_r1_s4, GREATEST(5.0, v_score - 0.5),
         CASE WHEN v_score >= 7.8 THEN 'Linha da vida construída. Cliente entrou em reflexão profunda.' ELSE 'Despertar superficial. Dor não verbalizada.' END),
        (v_eval_id, v_r1_s5, GREATEST(5.0, v_score - 0.3),
         CASE WHEN v_score >= 7.5 THEN 'Coleta estruturada e completa. Pergunta de sentimento bem aplicada.' ELSE 'Coleta incompleta. Pergunta de sentimento fechada.' END),
        (v_eval_id, v_r1_s6, LEAST(10, v_score + 0.3),
         CASE WHEN v_score >= 8.0 THEN 'Curiosidade gerada. Próxima reunião agendada com cônjuge.' ELSE 'Curiosidade insuficiente. Agendamento sem confirmação de cônjuge.' END),
        (v_eval_id, v_r1_s7, GREATEST(4.5, v_score - 0.8),
         CASE WHEN v_score >= 7.5 THEN 'Pedido de recomendação com técnica. Nomes coletados.' ELSE 'Pedido superficial. Sem coleta de nomes.' END);
    ELSE
      -- 2ª Reunião
      INSERT INTO evaluation_section_results (evaluation_id, section_id, score, summary)
      VALUES
        (v_eval_id, v_r2_s1, LEAST(10, v_score + 0.3),
         CASE WHEN v_score >= 8.0 THEN 'Leitura de cenário precisa. Objeção tratada antes de avançar.' ELSE 'Avançou sem verificar estado do cliente.' END),
        (v_eval_id, v_r2_s2, LEAST(10, v_score + 0.4),
         CASE WHEN v_score >= 8.0 THEN 'Validação completa. Cliente confirmou todos os dados.' ELSE 'Validação parcial. Risco de objeção futura.' END),
        (v_eval_id, v_r2_s3, v_score,
         CASE WHEN v_score >= 7.8 THEN 'Gráficos apresentados com impacto emocional real.' ELSE 'Apresentação técnica sem conexão emocional.' END),
        (v_eval_id, v_r2_s4, GREATEST(5.0, v_score - 0.4),
         CASE WHEN v_score >= 8.0 THEN 'Solução fundamentada. Concordância tácita executada. Transição direta para proposta.' ELSE 'Solução sem fundamentação. Perguntou se quer fechar.' END),
        (v_eval_id, v_r2_s5, LEAST(10, v_score + 0.2),
         CASE WHEN v_score >= 7.5 THEN 'Ordem correta: saúde → beneficiários → financeiro. Parabenização feita.' ELSE 'Ordem errada. Iniciou pelo financeiro.' END),
        (v_eval_id, v_r2_s6, GREATEST(4.5, v_score - 0.6),
         CASE WHEN v_score >= 7.5 THEN 'Objeção tratada com técnica. Retornou ao fluxo imediatamente.' ELSE 'Objeção não tratada. Fluxo quebrado.' END),
        (v_eval_id, v_r2_s7, GREATEST(5.0, v_score - 0.5),
         CASE WHEN v_score >= 7.8 THEN 'Pedido após fechamento. Leads qualificados coletados.' ELSE 'Pedido mecânico sem qualificação.' END);
    END IF;

    -- 6. Criteria results (21 critérios)
    IF v_idx < 6 THEN
      -- 1ª Reunião
      INSERT INTO evaluation_criteria_results (evaluation_id, criterion_id, verdict, confidence, score, coaching_tip)
      VALUES
        -- S1: Conexão
        (v_eval_id, v_r1_s1_c1, CASE WHEN v_score >= 7.2 THEN 'met' ELSE 'partial' END, 0.91,
         LEAST(10, v_score + 0.5), 'Iniciar com pergunta sobre como conheceu o indicador — ativa confiança por associação.'),
        (v_eval_id, v_r1_s1_c2, CASE WHEN v_score >= 7.8 THEN 'met' ELSE 'partial' END, 0.86,
         LEAST(10, v_score + 0.3), 'Mencionar o indicador pelo nome nos primeiros 2 minutos.'),
        (v_eval_id, v_r1_s1_c3, CASE WHEN v_score >= 7.5 THEN 'met' ELSE 'not_met' END, 0.93,
         v_score, 'Pergunta de expectativa obrigatória antes de qualquer apresentação.'),
        -- S2: Confiança
        (v_eval_id, v_r1_s2_c1, CASE WHEN v_score >= 8.0 THEN 'met' ELSE 'partial' END, 0.88,
         LEAST(10, v_score + 0.2), 'Pitch: máx 1 minuto. Incluir história + propósito + elemento pessoal.'),
        (v_eval_id, v_r1_s2_c2, CASE WHEN v_score >= 7.2 THEN 'met' ELSE 'not_met' END, 0.90,
         v_score, 'Qualquer pergunta sobre renda ou produto nessa etapa deve ser penalizada.'),
        (v_eval_id, v_r1_s2_c3, CASE WHEN v_score >= 7.8 THEN 'met' ELSE 'partial' END, 0.82,
         GREATEST(5.0, v_score - 0.3), 'Meta: cliente fala >50% do tempo nessa etapa.'),
        -- S3: Credibilidade
        (v_eval_id, v_r1_s3_c1, CASE WHEN v_score >= 7.0 THEN 'met' ELSE 'not_met' END, 0.95,
         v_score, 'Sem material visual = sem credibilidade. Obrigatório.'),
        (v_eval_id, v_r1_s3_c2, CASE WHEN v_score >= 7.5 THEN 'met' ELSE 'partial' END, 0.87,
         GREATEST(5.0, v_score - 0.5), 'Explicar processo em 3 blocos: entender → estruturar → implementar.'),
        (v_eval_id, v_r1_s3_c3, CASE WHEN v_score >= 7.2 THEN 'met' ELSE 'partial' END, 0.84,
         GREATEST(5.0, v_score - 0.4), 'Citar companhia com pelo menos 1 dado concreto (anos, porte ou presença).'),
        -- S4: Despertar
        (v_eval_id, v_r1_s4_c1, CASE WHEN v_score >= 7.5 THEN 'met' ELSE 'partial' END, 0.89,
         GREATEST(4.5, v_score - 0.6), 'Linha da vida: usar dados que o cliente mesmo trouxe.'),
        (v_eval_id, v_r1_s4_c2, CASE WHEN v_score >= 7.8 THEN 'met' ELSE 'partial' END, 0.86,
         GREATEST(4.5, v_score - 0.5), 'Pergunta de implicação obrigatória: "Como ficaria a sua família?"'),
        (v_eval_id, v_r1_s4_c3, CASE WHEN v_score >= 8.2 THEN 'met' ELSE 'not_met' END, 0.79,
         GREATEST(4.0, v_score - 1.0), 'Técnica do silêncio: 3-8 segundos após pergunta relevante. Não preencher o silêncio.'),
        -- S5: Levantamento
        (v_eval_id, v_r1_s5_c1, CASE WHEN v_score >= 7.2 THEN 'met' ELSE 'partial' END, 0.90,
         GREATEST(5.0, v_score - 0.4), 'Usar formulário estruturado visível ao cliente.'),
        (v_eval_id, v_r1_s5_c2, CASE WHEN v_score >= 7.5 THEN 'met' ELSE 'partial' END, 0.88,
         GREATEST(5.0, v_score - 0.5), 'Cobrir: família + educação + despesas + dívidas + renda + patrimônio.'),
        (v_eval_id, v_r1_s5_c3, CASE WHEN v_score >= 8.0 THEN 'met' ELSE 'not_met' END, 0.85,
         GREATEST(4.5, v_score - 0.8), 'Pergunta de sentimento ABERTA. Nunca: "Fez sentido?" — sempre: "O que você sente a respeito?"'),
        -- S6: Curiosidade
        (v_eval_id, v_r1_s6_c1, CASE WHEN v_score >= 7.8 THEN 'met' ELSE 'partial' END, 0.87,
         LEAST(10, v_score + 0.4), 'Usar frases de impacto sem revelar a solução.'),
        (v_eval_id, v_r1_s6_c2, CASE WHEN v_score >= 7.0 THEN 'met' ELSE 'not_met' END, 0.94,
         LEAST(10, v_score + 0.3), 'Sem agendamento = reunião incompleta.'),
        (v_eval_id, v_r1_s6_c3, CASE WHEN v_score >= 7.5 THEN 'met' ELSE 'partial' END, 0.83,
         v_score, 'Solicitar cônjuge: "Esse é um momento importante para ambos…"'),
        -- S7: Recomendação R1
        (v_eval_id, v_r1_s7_c1, CASE WHEN v_score >= 7.5 THEN 'met' ELSE 'partial' END, 0.86,
         GREATEST(4.5, v_score - 0.7), 'Criar sequência de "sim" antes de pedir recomendação.'),
        (v_eval_id, v_r1_s7_c2, CASE WHEN v_score >= 7.2 THEN 'met' ELSE 'not_met' END, 0.82,
         GREATEST(4.5, v_score - 0.8), 'Pedir nomes + profissão + contexto familiar. Nunca só "alguém".'),
        (v_eval_id, v_r1_s7_c3, CASE WHEN v_score >= 7.8 THEN 'met' ELSE 'not_met' END, 0.80,
         GREATEST(4.0, v_score - 1.0), 'Oferecer mensagem pronta ou perguntar se pode mencionar o nome do cliente.');
    ELSE
      -- 2ª Reunião
      INSERT INTO evaluation_criteria_results (evaluation_id, criterion_id, verdict, confidence, score, coaching_tip)
      VALUES
        -- S1: Leitura de Cenário
        (v_eval_id, v_r2_s1_c1, CASE WHEN v_score >= 7.2 THEN 'met' ELSE 'not_met' END, 0.92,
         LEAST(10, v_score + 0.4), 'Começar com "Da nossa última conversa, o que passou pela sua cabeça?" — nunca ir direto para a apresentação.'),
        (v_eval_id, v_r2_s1_c2, CASE WHEN v_score >= 7.8 THEN 'met' ELSE 'partial' END, 0.88,
         LEAST(10, v_score + 0.2), 'Escutar 100% sem interromper. Defender antes de entender é o maior erro aqui.'),
        (v_eval_id, v_r2_s1_c3, CASE WHEN v_score >= 8.0 THEN 'met' ELSE 'not_met' END, 0.85,
         v_score, 'Regra de ouro: nunca apresentar com objeção ativa. Tratar e confirmar alinhamento.'),
        -- S2: Validação
        (v_eval_id, v_r2_s2_c1, CASE WHEN v_score >= 7.5 THEN 'met' ELSE 'partial' END, 0.90,
         LEAST(10, v_score + 0.4), 'Frase de transição posiciona profissionalismo — não pular.'),
        (v_eval_id, v_r2_s2_c2, CASE WHEN v_score >= 7.2 THEN 'met' ELSE 'partial' END, 0.89,
         LEAST(10, v_score + 0.3), 'Confirmação ativa: "Está fiel ao que você vive hoje?" após cada bloco.'),
        (v_eval_id, v_r2_s2_c3, CASE WHEN v_score >= 7.8 THEN 'met' ELSE 'partial' END, 0.86,
         LEAST(10, v_score + 0.2), '"Esse é o seu cenário." — essa frase tira espaço para objeção de valor depois.'),
        -- S3: Gráficos
        (v_eval_id, v_r2_s3_c1, CASE WHEN v_score >= 7.0 THEN 'met' ELSE 'partial' END, 0.91,
         v_score, 'Cenário atual primeiro: cliente precisa se sentir bem antes de sentir o risco.'),
        (v_eval_id, v_r2_s3_c2, CASE WHEN v_score >= 7.5 THEN 'met' ELSE 'partial' END, 0.87,
         GREATEST(5.0, v_score - 0.4), '"Você gostaria de depender de alguém?" — pergunta mais poderosa da etapa.'),
        (v_eval_id, v_r2_s3_c3, CASE WHEN v_score >= 7.8 THEN 'met' ELSE 'partial' END, 0.84,
         GREATEST(5.0, v_score - 0.5), 'Cada gráfico precisa de pergunta reflexiva personalizada com dados do cliente.'),
        -- S4: Solução
        (v_eval_id, v_r2_s4_c1, CASE WHEN v_score >= 7.5 THEN 'met' ELSE 'partial' END, 0.90,
         GREATEST(4.8, v_score - 0.6), 'Fundamentar: "Trouxe X porque você me disse que…" — número deixa de ser arbitrário.'),
        (v_eval_id, v_r2_s4_c2, CASE WHEN v_score >= 8.0 THEN 'met' ELSE 'not_met' END, 0.88,
         GREATEST(4.5, v_score - 0.8), 'Concordância tácita: aguardar "sim" após cada benefício antes de continuar.'),
        (v_eval_id, v_r2_s4_c3, CASE WHEN v_score >= 8.2 THEN 'met' ELSE 'not_met' END, 0.83,
         GREATEST(4.2, v_score - 1.0), 'Nunca "você quer fechar?". Sempre "vamos preencher a proposta." — assunção de continuidade.'),
        -- S5: Proposta
        (v_eval_id, v_r2_s5_c1, CASE WHEN v_score >= 7.2 THEN 'met' ELSE 'not_met' END, 0.93,
         LEAST(10, v_score + 0.3), 'Sempre começar pela saúde — cria seriedade e posiciona a proposta como criteriosa.'),
        (v_eval_id, v_r2_s5_c2, CASE WHEN v_score >= 7.5 THEN 'met' ELSE 'partial' END, 0.89,
         LEAST(10, v_score + 0.2), '"Quem você quer proteger?" reconecta com o propósito — usar com intenção.'),
        (v_eval_id, v_r2_s5_c3, CASE WHEN v_score >= 7.8 THEN 'met' ELSE 'partial' END, 0.87,
         LEAST(10, v_score + 0.1), 'Parabenizar é técnica — evita arrependimento pós-decisão. Obrigatório.'),
        -- S6: Objeções
        (v_eval_id, v_r2_s6_c1, CASE WHEN v_score >= 7.5 THEN 'met' ELSE 'not_met' END, 0.88,
         GREATEST(4.5, v_score - 0.6), '"O que exatamente te fez pensar isso?" — isolar antes de tratar.'),
        (v_eval_id, v_r2_s6_c2, CASE WHEN v_score >= 7.8 THEN 'met' ELSE 'partial' END, 0.84,
         GREATEST(4.2, v_score - 0.8), 'Técnica bumerangue: usar a objeção como argumento.'),
        (v_eval_id, v_r2_s6_c3, CASE WHEN v_score >= 8.0 THEN 'met' ELSE 'not_met' END, 0.82,
         GREATEST(4.0, v_score - 1.0), 'Após tratar: volta IMEDIATA à proposta. "Me fala… quando foi ao médico?" — sem pausa.'),
        -- S7: Recomendação R2
        (v_eval_id, v_r2_s7_c1, CASE WHEN v_score >= 7.5 THEN 'met' ELSE 'partial' END, 0.90,
         GREATEST(4.8, v_score - 0.6), 'Melhor momento do processo: cliente comprou, confia. Reforçar a decisão antes de pedir.'),
        (v_eval_id, v_r2_s7_c2, CASE WHEN v_score >= 7.2 THEN 'met' ELSE 'partial' END, 0.86,
         GREATEST(4.5, v_score - 0.7), '"Alguém que tenha família como você…" — direcionar perfil aumenta qualidade do lead.'),
        (v_eval_id, v_r2_s7_c3, CASE WHEN v_score >= 7.8 THEN 'met' ELSE 'not_met' END, 0.83,
         GREATEST(4.2, v_score - 0.8), '"Posso falar que foi você?" — definir a abordagem dentro da reunião.');
    END IF;

    v_idx := v_idx + 1;
  END LOOP;

  RAISE NOTICE '08_coach_pro: % reuniões processadas (6 × 1ª Reunião + 6 × 2ª Reunião).', v_idx;
END $$;
