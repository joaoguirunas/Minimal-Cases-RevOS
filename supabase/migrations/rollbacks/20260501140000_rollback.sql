-- Rollback for: 20260501140000_ora_schema_drift_reconcile.sql
-- Tested-against: pg15
-- Reverte:
--   Opção A: stage_ids uuid[] → text[]
--   Opção C: DROP COLUMN pipeline_ids
-- WARNING: rollback de DROP COLUMN é destrutivo — perde valores em pipeline_ids.

BEGIN;

-- ─── Reverter Opção A: stage_ids uuid[] → text[] ────────────────────
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

  IF v_current_type = 'uuid[]' THEN
    EXECUTE 'ALTER TABLE public.ai_agents
             ALTER COLUMN stage_ids TYPE text[]
             USING stage_ids::text[]';
  ELSIF v_current_type = 'text[]' THEN
    RAISE NOTICE 'ai_agents.stage_ids já é text[] — no-op';
  ELSE
    RAISE EXCEPTION
      'ai_agents.stage_ids tem tipo inesperado: %. Esperado uuid[] ou text[].',
      v_current_type;
  END IF;
END
$$;

-- ─── Reverter Opção C: DROP COLUMN pipeline_ids ─────────────────────
ALTER TABLE public.ai_agents DROP COLUMN IF EXISTS pipeline_ids;

COMMIT;
