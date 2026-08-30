-- ═══════════════════════════════════════════════════════════════════
-- 20260527140000_pipe_3_1_dedup_constraints.sql
-- Brief: Story PIPE-3.1 — adiciona UNIQUE partial indexes para fechar gaps de dedup
--        em leads/clients_people/form_pro_submissions + muda default de
--        inbound_webhooks.create_mode para 'criar_se_nao_existir'.
--
-- Pre-flight check: aborta a migration se duplicatas existirem hoje, com
-- mensagem orientativa para o operador (executar merge_persons antes).
--
-- Diagnóstico: docs/smart-memory/agents/research/dedup-analysis.md
-- ═══════════════════════════════════════════════════════════════════
-- @lint-skip MIG002 reason: adiciona constraints + change default; rollback documentado.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 0) PRE-FLIGHT CHECK — aborta se duplicatas existirem
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_dup_email      int;
  v_dup_whatsapp   int;
  v_dup_leads      int;
  v_dup_meta       int;
  v_msg            text;
BEGIN
  -- clients_people.email duplicado entre rows ativas/inativas/archived (não-merged)
  SELECT count(*) INTO v_dup_email FROM (
    SELECT email
    FROM public.clients_people
    WHERE email IS NOT NULL
      AND status <> 'merged'
    GROUP BY email
    HAVING count(*) > 1
  ) s;

  -- clients_people.whatsapp duplicado
  SELECT count(*) INTO v_dup_whatsapp FROM (
    SELECT whatsapp
    FROM public.clients_people
    WHERE whatsapp IS NOT NULL
      AND status <> 'merged'
    GROUP BY whatsapp
    HAVING count(*) > 1
  ) s;

  -- leads (people_id, leads_pipelines_id) duplicado entre status NÃO finais
  SELECT count(*) INTO v_dup_leads FROM (
    SELECT people_id, leads_pipelines_id
    FROM public.leads
    WHERE people_id IS NOT NULL
      AND leads_pipelines_id IS NOT NULL
      AND status NOT IN ('won','lost','archived')
    GROUP BY people_id, leads_pipelines_id
    HAVING count(*) > 1
  ) s;

  -- form_pro_submissions.meta_leadgen_id duplicado
  SELECT count(*) INTO v_dup_meta FROM (
    SELECT meta_leadgen_id
    FROM public.form_pro_submissions
    WHERE meta_leadgen_id IS NOT NULL
    GROUP BY meta_leadgen_id
    HAVING count(*) > 1
  ) s;

  IF v_dup_email > 0 OR v_dup_whatsapp > 0 OR v_dup_leads > 0 OR v_dup_meta > 0 THEN
    v_msg := format(
      E'PIPE-3.1 migration ABORTED — duplicates pre-existing:\n'
      '  - clients_people.email duplicates:         % distinct keys\n'
      '  - clients_people.whatsapp duplicates:      % distinct keys\n'
      '  - leads(people_id, pipeline_id) actives:   % distinct keys\n'
      '  - form_pro_submissions.meta_leadgen_id:    % distinct keys\n'
      'Action: review the queries in docs/smart-memory/agents/research/dedup-analysis.md\n'
      '        run public.merge_persons(canonical_id, duplicate_id) for each pair, then retry.',
      v_dup_email, v_dup_whatsapp, v_dup_leads, v_dup_meta
    );
    RAISE EXCEPTION '%', v_msg;
  ELSE
    RAISE NOTICE 'PIPE-3.1: pre-flight OK — 0 duplicates';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 1) UNIQUE partial em clients_people.email
-- ═══════════════════════════════════════════════════════════════════
-- Já existe idx_people_email (LOWER, non-unique) para performance.
-- Esse índice abaixo é case-sensitive para casar com crm-mapper.upsertPerson
-- (que faz .eq('email', value) sem LOWER).
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_people_email_unique
  ON public.clients_people (email)
  WHERE email IS NOT NULL AND status <> 'merged';

COMMENT ON INDEX public.idx_clients_people_email_unique IS
  'PIPE-3.1: dedup duro de email (case-sensitive — casa com crm-mapper.upsertPerson). Exclui merged.';

-- ═══════════════════════════════════════════════════════════════════
-- 2) UNIQUE partial em clients_people.whatsapp
-- ═══════════════════════════════════════════════════════════════════
-- crm-mapper.normalizePhone já normaliza para "55..." sem caracteres não-digit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_people_whatsapp_unique
  ON public.clients_people (whatsapp)
  WHERE whatsapp IS NOT NULL AND status <> 'merged';

COMMENT ON INDEX public.idx_clients_people_whatsapp_unique IS
  'PIPE-3.1: dedup duro de whatsapp normalizado. Exclui merged.';

-- ═══════════════════════════════════════════════════════════════════
-- 3) UNIQUE partial em leads (people_id, leads_pipelines_id) — apenas leads ativos
-- ═══════════════════════════════════════════════════════════════════
-- Status canônicos: 'in_progress'|'won'|'lost'|'archived' (p8/fix_leads_status_ativo).
-- Permite múltiplos leads finalizados (won/lost/archived) por (pessoa, pipeline) —
-- semântica: pessoa pode voltar ao pipeline depois de fechar/perder negócio anterior.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_people_pipeline_active_unique
  ON public.leads (people_id, leads_pipelines_id)
  WHERE people_id IS NOT NULL
    AND leads_pipelines_id IS NOT NULL
    AND status NOT IN ('won', 'lost', 'archived');

COMMENT ON INDEX public.idx_leads_people_pipeline_active_unique IS
  'PIPE-3.1: dedup de leads "abertos" (status NOT IN won/lost/archived). Permite reentrada após fechamento.';

-- ═══════════════════════════════════════════════════════════════════
-- 4) UNIQUE partial em form_pro_submissions.meta_leadgen_id
-- ═══════════════════════════════════════════════════════════════════
-- Garante que cada Meta leadgen_id seja importado uma única vez,
-- mesmo em race entre chamadas paralelas de meta-leadgen-sync.
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_pro_submissions_meta_leadgen_unique
  ON public.form_pro_submissions (meta_leadgen_id)
  WHERE meta_leadgen_id IS NOT NULL;

COMMENT ON INDEX public.idx_form_pro_submissions_meta_leadgen_unique IS
  'PIPE-3.1: dedup duro de Meta leadgen_id (race-safe import).';

-- ═══════════════════════════════════════════════════════════════════
-- 5) Default de inbound_webhooks.create_mode → 'criar_se_nao_existir'
-- ═══════════════════════════════════════════════════════════════════
-- Razão: a queixa "leads duplicados" é majoritariamente consequência de webhooks
-- criados pela UI sem revisar o create_mode (que era 'criar' por default e força
-- INSERT de novo lead a cada hit, ignorando dedup de pipeline).
--
-- NÃO faz backfill — rows existentes preservam o estado configurado (mesmo que
-- via default antigo). Operador re-edita pela UI se desejar. Motivo: distinguir
-- "default automático" de "escolha consciente do operador" é impossível e o backfill
-- poderia trocar comportamento de webhooks intencionais.
ALTER TABLE public.inbound_webhooks
  ALTER COLUMN create_mode SET DEFAULT 'criar_se_nao_existir';

COMMENT ON COLUMN public.inbound_webhooks.create_mode IS
  'Controla comportamento ao receber payload: criar | criar_se_nao_existir | atualizar_etapa | somente_etapa. Default (PIPE-3.1): criar_se_nao_existir.';

-- ═══════════════════════════════════════════════════════════════════
-- 6) Verificação final (informacional)
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_indexes_created int;
  v_default text;
BEGIN
  SELECT count(*) INTO v_indexes_created
  FROM pg_indexes
  WHERE indexname IN (
    'idx_clients_people_email_unique',
    'idx_clients_people_whatsapp_unique',
    'idx_leads_people_pipeline_active_unique',
    'idx_form_pro_submissions_meta_leadgen_unique'
  );

  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='inbound_webhooks'
    AND column_name='create_mode';

  IF v_indexes_created < 4 THEN
    RAISE EXCEPTION 'PIPE-3.1 verification failed: only %/4 unique indexes created', v_indexes_created;
  END IF;

  IF v_default NOT LIKE '%criar_se_nao_existir%' THEN
    RAISE EXCEPTION 'PIPE-3.1 verification failed: create_mode default is %, expected criar_se_nao_existir', v_default;
  END IF;

  RAISE NOTICE 'PIPE-3.1 verified OK — 4 unique indexes + create_mode default updated';
END $$;

COMMIT;
