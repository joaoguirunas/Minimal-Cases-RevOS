-- FWUP-03: Canonicalizar schema de leads_stages_followups
--
-- Três migrations conflitantes (20251005, 20251110, 20251202) criaram
-- leads_stages_followups com schemas distintos via CREATE TABLE IF NOT EXISTS,
-- causando drift potencial entre tenants dependendo da ordem de aplicação.
--
-- Esta migration normaliza o schema para o estado canônico:
-- FK canônica: leads_stages_id (NOT NULL)
-- Delay: days / hours / minutes  (não delay_minutes)
-- Sem: stage_id (FK duplicada), name, delay_minutes
--
-- IMPORTANTE: executar dry-run antes de aplicar em produção:
-- psql $DATABASE_URL -c "BEGIN; \i supabase/migrations/20260427040000_fwup03_canonicalize_leads_stages_followups.sql; ROLLBACK;"

BEGIN;

-- ─── Fase 1: garantir colunas canônicas (idempotente) ────────────────────────

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS leads_stages_id uuid REFERENCES public.leads_stages(id) ON DELETE CASCADE;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS score_matrix_id uuid REFERENCES public.score_matrix(id) ON DELETE SET NULL;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS target_stage_id uuid REFERENCES public.leads_stages(id) ON DELETE SET NULL;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS control integer;

-- ─── Fase 2: backfill leads_stages_id a partir de stage_id (se existir) ──────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads_stages_followups'
      AND column_name = 'stage_id'
  ) THEN
    UPDATE public.leads_stages_followups
    SET leads_stages_id = stage_id
    WHERE leads_stages_id IS NULL
      AND stage_id IS NOT NULL;

    RAISE NOTICE 'FWUP-03: backfill de stage_id → leads_stages_id concluído. Rows afetadas: %',
      (SELECT COUNT(*) FROM public.leads_stages_followups WHERE leads_stages_id IS NOT NULL);
  END IF;
END $$;

-- ─── Fase 3: drop de colunas órfãs ───────────────────────────────────────────

-- stage_id: FK duplicada com nome errado (schema B e C vs schema A que usa leads_stages_id)
ALTER TABLE public.leads_stages_followups
  DROP COLUMN IF EXISTS stage_id;

-- name: campo obrigatório em schema B/C, inexistente no schema A canônico
-- Frontend nunca lê nem escreve este campo
ALTER TABLE public.leads_stages_followups
  DROP COLUMN IF EXISTS name;

-- delay_minutes: representação alternativa de delay usada em schema B/C
-- Schema canônico usa days + hours + minutes separados
ALTER TABLE public.leads_stages_followups
  DROP COLUMN IF EXISTS delay_minutes;

-- ─── Fase 4: índices canônicos ────────────────────────────────────────────────

-- Índice primário de lookup (por etapa, ativos)
CREATE INDEX IF NOT EXISTS idx_leads_stages_fup_stage_active
  ON public.leads_stages_followups (leads_stages_id, active)
  WHERE active = true;

-- Índice para score matrix (filtro alternativo)
CREATE INDEX IF NOT EXISTS idx_leads_stages_fup_score
  ON public.leads_stages_followups (score_matrix_id)
  WHERE score_matrix_id IS NOT NULL;

-- Índice para target_stage_id (FK lookup)
CREATE INDEX IF NOT EXISTS idx_leads_stages_fup_target
  ON public.leads_stages_followups (target_stage_id)
  WHERE target_stage_id IS NOT NULL;

-- ─── Fase 5: smoke test ───────────────────────────────────────────────────────

DO $$
DECLARE
  v_orphan_stage_id    boolean;
  v_orphan_name        boolean;
  v_orphan_delay_min   boolean;
  v_has_canonical_fk   boolean;
  v_row_count          bigint;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads_stages_followups' AND column_name='stage_id'
  ) INTO v_orphan_stage_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads_stages_followups' AND column_name='name'
  ) INTO v_orphan_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads_stages_followups' AND column_name='delay_minutes'
  ) INTO v_orphan_delay_min;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads_stages_followups' AND column_name='leads_stages_id'
  ) INTO v_has_canonical_fk;

  SELECT COUNT(*) INTO v_row_count FROM public.leads_stages_followups;

  IF v_orphan_stage_id THEN
    RAISE EXCEPTION 'FWUP-03 SMOKE FAIL: coluna stage_id ainda existe';
  END IF;
  IF v_orphan_name THEN
    RAISE EXCEPTION 'FWUP-03 SMOKE FAIL: coluna name ainda existe';
  END IF;
  IF v_orphan_delay_min THEN
    RAISE EXCEPTION 'FWUP-03 SMOKE FAIL: coluna delay_minutes ainda existe';
  END IF;
  IF NOT v_has_canonical_fk THEN
    RAISE EXCEPTION 'FWUP-03 SMOKE FAIL: coluna canonical leads_stages_id não existe';
  END IF;

  RAISE NOTICE 'FWUP-03 SMOKE PASS — schema canônico verificado. Rows: %', v_row_count;
END $$;

COMMIT;
