-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  AI AGENTS — QUALIFICATION FIX                                             ║
-- ║  Bug #1: upsert_crm_field_value RPC alias (N8N MCP tool name mismatch)    ║
-- ║  Bug #2: Seed ai_agents_steps for qualification template (was missing)     ║
-- ║  Bug #3: leads.control column safety-net (ensures column exists)           ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX #1: upsert_crm_field_value — alias for update_qualification_field
-- N8N MCP tool "Atualizar Campo Qualificação" calls:
--   POST /rest/v1/rpc/upsert_crm_field_value
-- Migration 20260224000000_unify_field_tables unified crm_field_* → lead_field_*
-- so this function writes to lead_field_values (not crm_field_values, which is dropped)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.upsert_crm_field_value(
  p_person_id UUID,
  p_field_key TEXT,
  p_value     TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_definition_id UUID;
BEGIN
  SELECT id INTO v_definition_id
  FROM public.lead_field_definitions
  WHERE key = p_field_key
    AND entity_type = 'pessoa'
    AND active = true
  LIMIT 1;

  IF v_definition_id IS NULL THEN
    RAISE WARNING 'upsert_crm_field_value: field_key "%" not found in lead_field_definitions (entity_type=pessoa)', p_field_key;
    RETURN;
  END IF;

  INSERT INTO public.lead_field_values (
    entity_type, entity_id, field_definition_id, value_text
  )
  VALUES ('pessoa', p_person_id, v_definition_id, p_value)
  ON CONFLICT ON CONSTRAINT lead_field_values_entity_def_uniq
  DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_crm_field_value TO authenticated, service_role;

COMMENT ON FUNCTION public.upsert_crm_field_value IS
  'N8N MCP tool "Atualizar Campo Qualificação" — writes to lead_field_values (unified field store)';


-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX #2 (safety-net): leads.control column
-- N8N creates leads with control='1' and advances via PATCH.
-- Ensure column exists (may already exist from older migrations).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS control TEXT DEFAULT '1';


-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX #3: Seed ai_agents_steps for "Template — Qualificação"
--
-- Template created in 20260223000000 with use_stages=true but ZERO steps.
-- N8N queries: SELECT * FROM ai_agents_steps WHERE ai_agent_id=? AND control=?
-- Without steps, agent never executes — this is the core qualification blocker.
--
-- 4 steps mapped to Q fields:
--   Step 1 (control='1') — Identificação         → q1, q2
--   Step 2 (control='2') — Necessidades           → q3, q4, q5, q6, q7, q8
--   Step 3 (control='3') — Orçamento & Urgência   → q10, q11, q12, q13, q14
--   Step 4 (control='4') — Decisor & Fechamento   → q9, q15–q26
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_agent_id UUID;
BEGIN
  -- Find the qualification template
  SELECT id INTO v_agent_id
  FROM public.ai_agents
  WHERE is_template = true AND template_type = 'qualificacao'
  LIMIT 1;

  IF v_agent_id IS NULL THEN
    RAISE NOTICE 'qualification template not found — skipping step seed';
    RETURN;
  END IF;

  -- Only seed if no steps exist yet
  IF EXISTS (SELECT 1 FROM public.ai_agents_steps WHERE ai_agent_id = v_agent_id) THEN
    RAISE NOTICE 'steps already exist for qualification template — skipping';
    RETURN;
  END IF;

  -- ─── STEP 1 — Identificação ─────────────────────────────────────────────
  INSERT INTO public.ai_agents_steps (ai_agent_id, name, prompt, control, order_index, active)
  VALUES (
    v_agent_id,
    '1 — Identificação',
    $prompt$
## Etapa 1 — Identificação

Você está iniciando a qualificação. Seu objetivo nesta etapa é:
1. Confirmar o nome e cargo da pessoa
2. Identificar a empresa e segmento de atuação
3. Descobrir o principal gargalo/dor que motivou o contato

**Como conduzir:**
- Se o nome já está disponível nos dados de contexto, confirme e avance direto para a dor
- Faça perguntas abertas e consultivas — nunca um interrogatório
- Demonstre interesse genuíno no negócio do lead
- Quando tiver nome, cargo, empresa e gargalo → salve e avance

**Ações obrigatórias ao concluir:**
1. Use a tool `Atualizar Pessoa` para salvar: `name`, `cargo` (se informado)
2. Use a tool `Atualizar Campo Qualificação` para salvar:
   - `q1_gargalo_principal` — o principal problema/dor descrito pelo lead
   - `q2_tamanho_equipe` — quantas pessoas na equipe comercial (se mencionado)
3. Use a tool `Atualizar Lead` com `{"control": "2"}` para avançar para a próxima etapa

**Não avance** sem ter pelo menos o nome da pessoa e uma descrição do gargalo principal.
$prompt$,
    '1',
    1,
    true
  );

  -- ─── STEP 2 — Necessidades ──────────────────────────────────────────────
  INSERT INTO public.ai_agents_steps (ai_agent_id, name, prompt, control, order_index, active)
  VALUES (
    v_agent_id,
    '2 — Necessidades',
    $prompt$
## Etapa 2 — Diagnóstico de Necessidades

Você já coletou o gargalo principal. Agora aprofunde o diagnóstico operacional do processo comercial atual.

**Informações a coletar:**
- Volume de leads que chegam por mês
- Taxa de conversão atual (% de leads que viram clientes)
- Ticket médio das vendas
- Duração média do ciclo de vendas (em dias)
- Quais ferramentas/sistemas usam hoje (CRM, WhatsApp, planilha, etc.)
- Como avaliam o engajamento dos leads (quente/frio, score, feeling)

**Como conduzir:**
- Você pode fazer 2-3 perguntas de uma vez se soar natural
- Use os números que o lead der para calcular impacto (ex: "com 100 leads e 5% conversão, são 5 clientes — se dobrarmos para 10%, seriam 5 clientes a mais por mês")
- Conecte o que você descobre ao gargalo identificado na etapa anterior

**Ações obrigatórias ao concluir:**
1. Use `Atualizar Campo Qualificação` para salvar o que foi coletado:
   - `q3_volume_leads_mes` — ex: "200 leads/mês"
   - `q4_taxa_conversao` — ex: "8%"
   - `q5_ticket_medio` — ex: "R$ 3.500"
   - `q6_ciclo_vendas` — ex: "21 dias"
   - `q7_ferramentas_atuais` — ex: "RD Station + WhatsApp + planilha"
   - `q8_nivel_engajamento` — ex: "Manual, por feeling do vendedor"
2. Use `Atualizar Lead` com `{"control": "3"}` para avançar

**Só avance** após ter pelo menos volume de leads e ferramentas atuais.
$prompt$,
    '2',
    2,
    true
  );

  -- ─── STEP 3 — Orçamento & Urgência ──────────────────────────────────────
  INSERT INTO public.ai_agents_steps (ai_agent_id, name, prompt, control, order_index, active)
  VALUES (
    v_agent_id,
    '3 — Orçamento & Urgência',
    $prompt$
## Etapa 3 — Orçamento & Urgência

Você já entende o negócio e as necessidades. Agora qualifique a capacidade e o timing de investimento.

**Informações a coletar:**
- Budget disponível para resolver o problema (mensal ou total do projeto)
- Prazo desejado para implementação / quando precisam de resultado
- Já tentaram resolver isso antes? O que não funcionou?
- Qual é a urgência de resolução — o que acontece se não resolverem nos próximos 90 dias?
- Qual seria o impacto financeiro de continuar com o problema atual?

**Como conduzir:**
- Aborde budget de forma indireta: "Para dimensionarmos a melhor solução, qual seria o investimento que faz sentido para vocês?"
- Se resistir a falar de budget, use âncoras: "Costumamos trabalhar com clientes que investem entre R$ X e R$ Y. Vocês se enquadrariam nessa faixa?"
- Explore o custo do problema atual — isso justifica o investimento
- Seja empático com tentativas anteriores — não critique o que fizeram antes

**Ações obrigatórias ao concluir:**
1. Use `Atualizar Campo Qualificação` para salvar:
   - `q10_budget_disponivel` — ex: "R$ 2.000/mês" ou "até R$ 30k total"
   - `q11_timeline_implementacao` — ex: "Querem resultado em 60 dias"
   - `q12_tentativas_anteriores` — ex: "Tentaram RD Station, pararam por falta de time"
   - `q13_urgencia_resolucao` — ex: "Alta — perdem contratos por demora no follow-up"
   - `q14_impacto_financeiro` — ex: "Estimam perder R$ 50k/mês em deals não fechados"
2. Use `Atualizar Lead` com `{"control": "4"}` para avançar

**Só avance** após ter budget e urgência minimamente mapeados.
$prompt$,
    '3',
    3,
    true
  );

  -- ─── STEP 4 — Decisor & Fechamento ──────────────────────────────────────
  INSERT INTO public.ai_agents_steps (ai_agent_id, name, prompt, control, order_index, active)
  VALUES (
    v_agent_id,
    '4 — Decisor & Fechamento',
    $prompt$
## Etapa 4 — Decisor, Perfil e Encaminhamento

Etapa final da qualificação. Mapeie quem decide, o cenário competitivo, e defina o próximo passo.

**Informações a coletar:**
- Quem é o decisor da compra? A pessoa com quem fala tem autonomia?
- Há outras soluções/concorrentes sendo avaliados?
- Qual o critério principal de decisão (preço, prazo, suporte, resultado garantido)?
- Existe algum sponsor interno que está "puxando" essa decisão?
- Quais as objeções ou medos que podem travar o avanço?
- Em uma escala de 0-10, qual o nível de interesse em avançar?
- Qual a probabilidade estimada de fechamento nos próximos 30 dias (%)?

**Perfil comportamental DISC (observe durante a conversa):**
- D (Dominante): direto, foca em resultado, impaciente com detalhes
- I (Influente): animado, fala bastante, gosta de novidade
- S (Estável): cauteloso, pede referências, não gosta de mudança abrupta
- C (Analítico): faz muitas perguntas técnicas, quer dados e garantias

**Ações obrigatórias ao concluir:**
1. Use `Atualizar Campo Qualificação` para salvar:
   - `q9_autoridade_decisao` — ex: "É o diretor comercial, decide sozinho"
   - `q15_concorrentes_avaliados` — ex: "Avaliando Exact Sales e HubSpot"
   - `q16_criterio_decisao` — ex: "Resultado garantido e suporte local"
   - `q17_objecoes_previstas` — ex: "Preocupação com onboarding e adoção do time"
   - `q18_sponsorship_interno` — ex: "CEO está pressionando por automação"
   - `q19_nivel_interesse` — número de 0 a 10 (ex: "8")
   - `q20_probabilidade_fechamento` — percentual (ex: "65")
   - `q21_status_qualificacao` — "qualified" se fit confirmado, "in_progress" se dúvidas, "unqualified" se não qualificado
   - `q24_disc_perfil` — "D", "I", "S" ou "C"
   - `q25_disc_analise` — análise detalhada do perfil comportamental observado
   - `q26_resumo_conversa` — resumo completo da qualificação para o consultor
2. Se qualificado → Use `Atualizar Lead` com `{"control": "5"}` e encaminhe para agendamento
3. Se não qualificado → Salve motivo em `q22_motivo_rejeicao` e use `Atualizar Lead` com `{"control": "5"}`

**Tom final:** Agradeça, valide o tempo do lead, e deixe claro o próximo passo (reunião com especialista, proposta, etc.)
$prompt$,
    '4',
    4,
    true
  );

  RAISE NOTICE 'qualification template steps seeded successfully for agent %', v_agent_id;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- Verification query (informational, runs at migration time)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_step_count INT;
  v_agent_id UUID;
BEGIN
  SELECT id INTO v_agent_id
  FROM public.ai_agents
  WHERE is_template = true AND template_type = 'qualificacao'
  LIMIT 1;

  SELECT COUNT(*) INTO v_step_count
  FROM public.ai_agents_steps
  WHERE ai_agent_id = v_agent_id;

  RAISE NOTICE 'qualification template (id=%) now has % step(s)', v_agent_id, v_step_count;
END;
$$;
