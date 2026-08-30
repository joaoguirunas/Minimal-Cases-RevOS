-- ═══════════════════════════════════════════════════════════════════
-- 20260501140000_ora_schema_drift_reconcile.sql
-- Brief: Reconcilia drift de schema em ai_agents (single-tenant ORA).
--   Opção A: stage_ids text[] → uuid[] (alinha com FWUP-15 + trigger notify_lead_stage_changed)
--   Opção C: ADD COLUMN pipeline_ids text[] (destrava save_agent_complete que referencia a coluna)
-- Drift origin: 20260310100000_add_pipeline_ids_to_ai_agents nunca propagada ao tenant
--   (ausente do client-migrations.json) + FWUP-15 usou ADD COLUMN IF NOT EXISTS,
--   no-op em tenants que receberam baseline 009 com stage_ids text[].
-- Reference: docs/smart-memory/agents/data-engineer/2026-05-01-ora-schema-drift.md
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Pre-flight safety check (Opção A) ──────────────────────────────
-- O cast text[] → uuid[] falha se algum elemento existente em stage_ids não for UUID válido.
-- Aborta a transação cedo com mensagem clara antes de tocar a coluna.
DO $$
DECLARE
  v_offender record;
BEGIN
  FOR v_offender IN
    SELECT a.id, a.name, x.elem
    FROM   public.ai_agents a,
           LATERAL unnest(a.stage_ids) AS x(elem)
    WHERE  a.stage_ids IS NOT NULL
      AND  array_length(a.stage_ids, 1) > 0
      AND  x.elem IS NOT NULL
      AND  x.elem !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  LOOP
    RAISE EXCEPTION
      'ai_agents.stage_ids contém valor não-UUID: agent_id=%, name=%, value=%. Aborte e limpe antes de aplicar.',
      v_offender.id, v_offender.name, v_offender.elem;
  END LOOP;
END
$$;

-- ─── Opção C: ADD COLUMN pipeline_ids text[] ────────────────────────
-- Idempotente. Backfill a partir de pipeline_id (singular) quando aplicável.
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS pipeline_ids text[];

UPDATE public.ai_agents
SET    pipeline_ids = ARRAY[pipeline_id::text]
WHERE  pipeline_id IS NOT NULL
  AND  (pipeline_ids IS NULL OR pipeline_ids = '{}');

-- ─── Opção A: stage_ids text[] → uuid[] ─────────────────────────────
-- Cast com USING — só executa se a coluna ainda for text[].
-- Usa DO block para idempotência (não falha se já estiver uuid[]).
DO $$
DECLARE
  v_current_type text;
BEGIN
  SELECT format_type(atttypid, atttypmod)
  INTO   v_current_type
  FROM   pg_attribute
  WHERE  attrelid = 'public.ai_agents'::regclass
    AND  attname  = 'stage_ids'
    AND  NOT attisdropped;

  IF v_current_type = 'text[]' THEN
    EXECUTE 'ALTER TABLE public.ai_agents
             ALTER COLUMN stage_ids TYPE uuid[]
             USING stage_ids::uuid[]';
  ELSIF v_current_type = 'uuid[]' THEN
    RAISE NOTICE 'ai_agents.stage_ids já é uuid[] — no-op';
  ELSE
    RAISE EXCEPTION
      'ai_agents.stage_ids tem tipo inesperado: %. Esperado text[] ou uuid[].',
      v_current_type;
  END IF;
END
$$;

COMMIT;

-- ─── Rollback inline (referência — execução real em rollbacks/) ──────
-- BEGIN;
--   ALTER TABLE public.ai_agents
--     ALTER COLUMN stage_ids TYPE text[]
--     USING stage_ids::text[];
--   ALTER TABLE public.ai_agents DROP COLUMN IF EXISTS pipeline_ids;
-- COMMIT;
