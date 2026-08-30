-- FWUP-09: DROP de 6 tabelas mortas + phantom fields em leads
--
-- Auditoria confirmada: zero referências em src/ e supabase/functions/
-- (apenas interfaces TypeScript opcionais em useStubsAll.ts — removidas separadamente)
--
-- Phantom fields em leads:
--   followup_attempts e followup_status aparecem apenas em type declarations
--   e em filtro Zod opcional em filter-leads-for-send (nunca escritos no DB)

BEGIN;

-- ─── 1. DROP das 6 tabelas mortas ─────────────────────────────────────────────

-- Dependências em cascade: verificar FKs que possam bloquear o DROP
-- Todas confirmadas sem FKs de outras tabelas ativas apontando para elas

DROP TABLE IF EXISTS public.crm_pipelines CASCADE;
DROP TABLE IF EXISTS public.crm_stages CASCADE;
DROP TABLE IF EXISTS public.crm_stage_followups CASCADE;
DROP TABLE IF EXISTS public.crm_agendamentos_followups CASCADE;
DROP TABLE IF EXISTS public.clients_meetings_followups CASCADE;
DROP TABLE IF EXISTS public.crm_campos_personalizados CASCADE;

-- ─── 2. DROP phantom fields em leads ──────────────────────────────────────────

ALTER TABLE public.leads
  DROP COLUMN IF EXISTS followup_attempts,
  DROP COLUMN IF EXISTS followup_status;

-- ─── 3. Smoke test ────────────────────────────────────────────────────────────

DO $$
DECLARE
  dead_table text;
  dead_tables text[] := ARRAY[
    'crm_pipelines', 'crm_stages', 'crm_stage_followups',
    'crm_agendamentos_followups', 'clients_meetings_followups', 'crm_campos_personalizados'
  ];
BEGIN
  FOREACH dead_table IN ARRAY dead_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = dead_table
    ) THEN
      RAISE EXCEPTION 'FWUP-09 SMOKE FAIL: tabela % ainda existe', dead_table;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads'
      AND column_name IN ('followup_attempts', 'followup_status')
  ) THEN
    RAISE EXCEPTION 'FWUP-09 SMOKE FAIL: phantom fields ainda existem em leads';
  END IF;

  RAISE NOTICE 'FWUP-09 SMOKE PASS — 6 tabelas dropadas, phantom fields removidos de leads.';
END $$;

COMMIT;
