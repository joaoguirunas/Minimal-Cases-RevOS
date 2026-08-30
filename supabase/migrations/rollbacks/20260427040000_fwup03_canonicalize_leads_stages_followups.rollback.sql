-- ROLLBACK: FWUP-03 canonicalização de leads_stages_followups
--
-- ATENÇÃO: este rollback restaura as colunas órfãs mas NÃO recupera
-- dados que estavam APENAS em stage_id/name/delay_minutes antes do DROP.
-- Se houve dados em stage_id que não foram backfillados para leads_stages_id,
-- esses dados foram perdidos na migration forward.
--
-- Aplicar apenas se a migration falhou parcialmente ou em rollback de emergência.

BEGIN;

-- Restaurar colunas órfãs (estrutura)
ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.leads_stages(id) ON DELETE CASCADE;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS delay_minutes integer DEFAULT 60;

-- Backfill reverso: preencher stage_id a partir de leads_stages_id
UPDATE public.leads_stages_followups
SET stage_id = leads_stages_id
WHERE stage_id IS NULL AND leads_stages_id IS NOT NULL;

-- Remover índices criados na migration
DROP INDEX IF EXISTS public.idx_leads_stages_fup_stage_active;
DROP INDEX IF EXISTS public.idx_leads_stages_fup_score;
DROP INDEX IF EXISTS public.idx_leads_stages_fup_target;

RAISE NOTICE 'FWUP-03 ROLLBACK concluído — colunas órfãs restauradas sem dados de name/delay_minutes';

COMMIT;
