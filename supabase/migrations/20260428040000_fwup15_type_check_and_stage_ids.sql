-- FWUP-15: Expandir type_check + adicionar stage_ids em ai_agents
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROBLEMA:
--   075 — INSERT em lead_field_definitions viola lead_field_definitions_type_check:
--         baseline (009) só permite 'text','number','single_select','boolean','date'.
--         'textarea' e 'select' foram adicionados pela unify_field_tables (fora do
--         client-migrations.json) e não chegaram no ORA.
--   081 — INSERT em ai_agents falha: coluna stage_ids não existe no baseline.
--
-- SOLUÇÃO:
--   1. Expandir constraint lead_field_definitions_type_check para incluir 'textarea'/'select'.
--   2. Adicionar stage_ids uuid[] em ai_agents.
--
-- IDEMPOTENTE: DROP IF EXISTS + ADD COLUMN IF NOT EXISTS.
-- SEM BEGIN/COMMIT: auto-commit por statement.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Expandir lead_field_definitions_type_check ────────────────────────────
DO $expand_type_check$
DECLARE
  con_name text;
BEGIN
  SELECT constraint_name INTO con_name
    FROM information_schema.table_constraints
   WHERE table_schema = 'public'
     AND table_name   = 'lead_field_definitions'
     AND constraint_type = 'CHECK'
     AND constraint_name LIKE '%type_check%'
   LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.lead_field_definitions DROP CONSTRAINT %I', con_name);
  END IF;
END $expand_type_check$;

ALTER TABLE public.lead_field_definitions
  ADD CONSTRAINT lead_field_definitions_type_check
  CHECK (type IN ('text', 'number', 'single_select', 'select', 'boolean', 'date', 'textarea'));

-- ── 2. ai_agents: stage_ids ──────────────────────────────────────────────────
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS stage_ids uuid[];
