-- ═══════════════════════════════════════════════════════════════════
-- 20260527130000_pipe_2_1_lead_field_curso.sql
-- Brief: Cria definição global do custom field "Curso" em lead_field_definitions
--        (entity_type=pessoa) para uso por webhooks por curso (Story PIPE-2.1).
--
-- Por que entity_type='pessoa':
--   A RPC upsert_crm_field_value (chamada por crm-mapper.persistCustomFields no
--   edge function webhook-inbound) é hardcoded para entity_type='pessoa'.
--   Custom fields enviados via webhook (namespace custom.*) sempre persistem como
--   atributo da pessoa, não do negócio. Mantemos consistência com q1..q26.
--
-- Idempotente: ON CONFLICT DO NOTHING preserva estado humano se a row já existir.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- O unique constraint canônico em lead_field_definitions é:
--   idx_lead_field_definitions_key_entity_pipeline (key, entity_type, pipeline_id)
-- com NULLS NOT DISTINCT — então NULL=NULL para fins de unicidade.
-- Criado em 20260224001000_unify_field_tables-ok.sql linha 47-48.
INSERT INTO public.lead_field_definitions (
  key,
  name,
  type,
  category,
  entity_type,
  pipeline_id,
  options,
  required,
  active,
  agent_managed,
  order_index
)
VALUES (
  'curso',
  'Curso',
  'text',                -- decisão do lead (2026-05-27): text, não single_select
  'qualificacao',
  'pessoa',
  NULL,                  -- global (cross-pipeline)
  '[]'::jsonb,           -- não usado por type=text — fica como array vazio por consistência de schema
  false,
  true,
  false,
  100                    -- ordem alta para aparecer no final da seção qualificação
)
ON CONFLICT (key, entity_type, pipeline_id) DO NOTHING;

-- Verificação informacional (não falha a migration se a row pré-existia com config diferente)
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.lead_field_definitions
  WHERE key = 'curso'
    AND entity_type = 'pessoa'
    AND pipeline_id IS NULL;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'PIPE-2.1: row curso/pessoa não foi criada — verificar constraint ou conflito';
  ELSE
    RAISE NOTICE 'PIPE-2.1: lead_field_definitions(curso/pessoa) presente — total rows: %', v_count;
  END IF;
END $$;

COMMIT;
