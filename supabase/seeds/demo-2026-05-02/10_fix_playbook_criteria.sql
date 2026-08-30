-- =====================================================================
-- Arquivo:  10_fix_playbook_criteria.sql
-- Objetivo: Corrigir playbooks da Erika adicionando 4 critérios que
--           estavam em falta vs. o documento original:
--           1. S3 1ª Reunião — SPIN profissional
--           2. S6 1ª Reunião — Confidencialidade
--           3. S3 2ª Reunião — Necessidade Acumulada + Tabelas
--           4. S4 2ª Reunião — Desafio da Companhia
-- Idempotente: ON CONFLICT DO NOTHING em todos os INSERTs
-- =====================================================================

DO $$
BEGIN

  -- ── 1. S3 1ª Reunião: SPIN profissional (C4) ──────────────────────
  -- Documento: "Perguntas (SPIN leve — voltado para validação de
  -- contexto profissional)" — Situação, Problema, Implicação, Necessidade
  INSERT INTO playbook_criteria (
    id, section_id, title, description, weight,
    detection_hints, example_good, example_bad, is_required, display_order
  ) VALUES (
    '77777777-0103-0004-0000-000000000001',
    '66666666-0103-0000-0000-000000000001',
    'Perguntas SPIN de contexto profissional',
    'Após credibilidade, inicia coleta suave de contexto profissional via SPIN leve: Situação (trabalho, há quanto tempo), Problema (já teve orientação?), Implicação (fez sentido na época?), Necessidade (o que quer entender).',
    1.0,
    ARRAY[
      '"Hoje você trabalha com o quê exatamente?"',
      '"Você atua há quanto tempo nessa área?"',
      '"Você já teve algum tipo de orientação ou planejamento nessa área?"',
      '"E fez sentido pra você na época?"',
      '"O que você gostaria de entender melhor sobre isso hoje?"'
    ],
    'Perguntas SPIN aplicadas com naturalidade após a apresentação de credibilidade. Transição orgânica para o diagnóstico.',
    'Corretor pula o contexto profissional e vai direto para o diagnóstico financeiro sem esta ponte de SPIN.',
    true, 4
  ) ON CONFLICT (id) DO NOTHING;

  UPDATE playbook_sections
  SET description = 'Materializar o trabalho do corretor com material visual, estrutura de trabalho e ancoragem institucional. SPIN leve de contexto profissional para transição ao diagnóstico.'
  WHERE id = '66666666-0103-0000-0000-000000000001';

  -- ── 2. S6 1ª Reunião: Confidencialidade (C4) ──────────────────────
  -- Documento: elemento 1 da estrutura — "Fechamento com segurança
  -- (confidencialidade)" antes de qualquer frase de curiosidade
  INSERT INTO playbook_criteria (
    id, section_id, title, description, weight,
    detection_hints, example_good, example_bad, is_required, display_order
  ) VALUES (
    '77777777-0106-0004-0000-000000000001',
    '66666666-0106-0000-0000-000000000001',
    'Agradecimento e garantia de confidencialidade',
    'Primeiro passo da etapa: agradecer pelas informações e tranquilizar o cliente sobre o uso dos dados. Reduz medo de exposição e resistência antes de qualquer frase de curiosidade.',
    1.0,
    ARRAY[
      '"Quero te agradecer pelas informações…"',
      '"Pode ficar muito tranquilo…"',
      '"Essas informações são totalmente confidenciais…"',
      '"Só eu vou ter acesso a isso…"'
    ],
    'Cliente tranquilizado sobre confidencialidade antes de qualquer avanço. Tom de cuidado e respeito.',
    'Corretor avança para curiosidade sem agradecer ou reforçar a confidencialidade das informações coletadas.',
    true, 4
  ) ON CONFLICT (id) DO NOTHING;

  UPDATE playbook_sections
  SET description = 'Agradecer + confidencialidade → posicionar personalização → gerar curiosidade (sem entregar solução) → agendar 2ª reunião com cônjuge.'
  WHERE id = '66666666-0106-0000-0000-000000000001';

  -- ── 3. S3 2ª Reunião: Necessidade Acumulada + Tabelas (C4) ────────
  -- Documento: gráfico 3 (pág 9-10) "Necessidade Acumulada — choque
  -- de realidade" + Tabelas (pág 10-11) "prova matemática final"
  INSERT INTO playbook_criteria (
    id, section_id, title, description, weight,
    detection_hints, example_good, example_bad, is_required, display_order
  ) VALUES (
    '77777777-0203-0004-0000-000000000001',
    '66666666-0203-0000-0000-000000000001',
    'Necessidade Acumulada, Comparação e Tabelas',
    'Gráfico 3: projeta o custo total de vida ao longo da expectativa ("X milhões"). Comparação potencial vs risco. Tabelas com GAP matemático entre o que precisa e o que tem disponível.',
    1.0,
    ARRAY[
      '"Esse gráfico aqui é um dos mais importantes…"',
      '"Aqui a gente projeta toda a sua estrutura de custo ao longo da vida…"',
      '"No seu caso, estamos falando de aproximadamente X milhões ao longo da vida…"',
      '"Isso sem aumentar padrão de vida, sem trocar de carro, sem crescer…"',
      '"Aqui detalha exatamente quanto você precisa… e aqui quanto você tem disponível…"',
      '"Esse valor aqui não está coberto…"'
    ],
    'Cliente visualmente impactado com a magnitude dos números. Verbaliza surpresa. GAP matemático entre necessidade e capacidade claramente compreendido.',
    'Corretor pula a necessidade acumulada e as tabelas. Cliente não tem visão do custo total de vida nem do gap real entre proteção necessária e existente.',
    true, 4
  ) ON CONFLICT (id) DO NOTHING;

  -- ── 4. S4 2ª Reunião: Desafio da Companhia (C4) ──────────────────
  -- Documento: "DESAFIO DA COMPANHIA (GENIAL)" — ativa urgência,
  -- curiosidade e desafio pessoal ao mencionar que a companhia
  -- pode aceitar, ajustar, melhorar ou recusar
  INSERT INTO playbook_criteria (
    id, section_id, title, description, weight,
    detection_hints, example_good, example_bad, is_required, display_order
  ) VALUES (
    '77777777-0204-0004-0000-000000000001',
    '66666666-0204-0000-0000-000000000001',
    'Técnica do Desafio da Companhia',
    'Após validação da solução, ativa o psicológico: a companhia vai analisar o perfil e pode aceitar, ajustar, melhorar ou recusar. Gera urgência, curiosidade e desafio pessoal — o cliente quer saber se será aceito.',
    1.0,
    ARRAY[
      '"A companhia vai analisar o seu perfil…"',
      '"Ela pode te aceitar… pode ajustar… ou até recusar…"',
      '"Há casos onde o benefício é até melhorado…"',
      '"Vai depender da análise que eles fizerem…"'
    ],
    'Cliente demonstra curiosidade e urgência sobre o resultado da análise. "Será que me aprovam?" — desafio pessoal ativado.',
    'Corretor apresenta a proposta sem mencionar a análise da companhia. Perde urgência e o gatilho do desafio.',
    true, 4
  ) ON CONFLICT (id) DO NOTHING;

  UPDATE playbook_sections
  SET description = 'Solução personalizada com fundamentação dos valores. Concordância tácita progressiva. Técnica do Desafio da Companhia. Transição direta para proposta sem perguntar.'
  WHERE id = '66666666-0204-0000-0000-000000000001';

  RAISE NOTICE '10_fix_playbook_criteria: 4 critérios inseridos, 3 descrições de secções actualizadas.';
END $$;
