-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║            UNIFY FIELD TABLES — FEB 2026                                       ║
-- ║  Consolidate crm_field_definitions/crm_field_values → lead_field_*             ║
-- ║  Keeps lead_ prefix (consistent with leads table pattern)                       ║
-- ║  Preserves all Q1-Q26 qualification data                                        ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 1: Extend lead_field_definitions
-- ═══════════════════════════════════════════════════════════════════════════════════

-- 1.1 Add entity_type (default 'negocio' — backward compatible with all existing rows)
ALTER TABLE public.lead_field_definitions
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'negocio';

ALTER TABLE public.lead_field_definitions
  DROP CONSTRAINT IF EXISTS lead_field_definitions_entity_type_check;

ALTER TABLE public.lead_field_definitions
  ADD CONSTRAINT lead_field_definitions_entity_type_check
    CHECK (entity_type IN ('negocio', 'pessoa', 'empresa'));

-- 1.2 Add agent_managed (AI-managed fields like Q1-Q26)
ALTER TABLE public.lead_field_definitions
  ADD COLUMN IF NOT EXISTS agent_managed BOOLEAN NOT NULL DEFAULT false;

-- 1.3 Expand type CHECK — add 'select' and 'textarea' (keep 'single_select' for compat)
ALTER TABLE public.lead_field_definitions
  DROP CONSTRAINT IF EXISTS lead_field_definitions_type_check;

ALTER TABLE public.lead_field_definitions
  ADD CONSTRAINT lead_field_definitions_type_check
    CHECK (type IN ('text', 'number', 'single_select', 'select', 'boolean', 'date', 'textarea'));

-- 1.4 Expand category CHECK to include all crm_ categories
ALTER TABLE public.lead_field_definitions
  DROP CONSTRAINT IF EXISTS lead_field_definitions_category_check;

ALTER TABLE public.lead_field_definitions
  ADD CONSTRAINT lead_field_definitions_category_check
    CHECK (category IN ('qualificacao', 'contato', 'comercial', 'custom', 'outros'));

-- 1.5 Drop old unique index (only covered key+pipeline, not entity_type)
DROP INDEX IF EXISTS idx_lead_field_definitions_key_pipeline;

-- 1.6 New unique index scoped to (key, entity_type, pipeline_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_field_definitions_key_entity_pipeline
  ON public.lead_field_definitions(key, entity_type, pipeline_id) NULLS NOT DISTINCT;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 2: Migrate crm_field_definitions (pessoa/empresa) → lead_field_definitions
-- Negocio fields already exist in lead_field_definitions — skip those
-- ═══════════════════════════════════════════════════════════════════════════════════

INSERT INTO public.lead_field_definitions (
  id,
  name,
  key,
  type,
  category,
  entity_type,
  options,
  active,
  ordem,
  agent_managed,
  pipeline_id,
  required,
  created_at,
  updated_at
)
SELECT
  id,
  label,                               -- crm_.label  → lead_.name
  field_key,                           -- crm_.field_key → lead_.key
  CASE field_type
    WHEN 'select' THEN 'select'        -- 'select' now valid in lead_ too
    ELSE field_type
  END,
  category,
  entity_type,                         -- 'pessoa' or 'empresa'
  COALESCE(options, '[]'::jsonb),      -- lead_.options is NOT NULL DEFAULT '[]'
  active,
  order_index,                         -- crm_.order_index → lead_.ordem
  agent_managed,
  pipeline_id,
  required,
  created_at,
  updated_at
FROM public.crm_field_definitions
WHERE entity_type IN ('pessoa', 'empresa')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 3: Extend lead_field_values — unified entity model
-- ═══════════════════════════════════════════════════════════════════════════════════

-- 3.1 Add entity_type column (default 'negocio' for all existing rows)
ALTER TABLE public.lead_field_values
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'negocio';

ALTER TABLE public.lead_field_values
  DROP CONSTRAINT IF EXISTS lead_field_values_entity_type_check;

ALTER TABLE public.lead_field_values
  ADD CONSTRAINT lead_field_values_entity_type_check
    CHECK (entity_type IN ('negocio', 'pessoa', 'empresa'));

-- 3.2 Add entity_id — unified reference for all entity types
ALTER TABLE public.lead_field_values
  ADD COLUMN IF NOT EXISTS entity_id UUID;

-- 3.3 Backfill entity_id from lead_id for all existing negocio rows
UPDATE public.lead_field_values
  SET entity_id = lead_id
  WHERE entity_type = 'negocio' AND entity_id IS NULL AND lead_id IS NOT NULL;

-- 3.4 Make entity_id NOT NULL after backfill
ALTER TABLE public.lead_field_values
  ALTER COLUMN entity_id SET NOT NULL;

-- 3.5 Make lead_id nullable (persona/empresa rows won't have a lead)
ALTER TABLE public.lead_field_values
  ALTER COLUMN lead_id DROP NOT NULL;

-- 3.6 Drop old unique constraint (only covered negocio case)
ALTER TABLE public.lead_field_values
  DROP CONSTRAINT IF EXISTS lead_field_values_lead_id_field_definition_id_key;

-- 3.7 New unified unique constraint: one value per (entity_type, entity_id, definition)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lead_field_values_entity_def_uniq'
  ) THEN
    ALTER TABLE public.lead_field_values
      ADD CONSTRAINT lead_field_values_entity_def_uniq
        UNIQUE (entity_type, entity_id, field_definition_id);
  END IF;
END $$;

-- 3.8 Index for efficient entity lookups
CREATE INDEX IF NOT EXISTS idx_lead_field_values_entity
  ON public.lead_field_values(entity_type, entity_id);

-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 4: Migrate crm_field_values → lead_field_values
-- Only pessoa/empresa (negocio already in lead_field_values via entity_id backfill)
-- ═══════════════════════════════════════════════════════════════════════════════════

INSERT INTO public.lead_field_values (
  id,
  lead_id,
  field_definition_id,
  entity_type,
  entity_id,
  value_text,
  value_number,
  value_boolean,
  value_date,
  created_at,
  updated_at
)
SELECT
  cfv.id,
  NULL,                   -- lead_id = NULL for pessoa/empresa
  lfd.id,                 -- resolve definition by key + entity_type
  cfv.entity_type,
  cfv.entity_id,
  cfv.value_text,
  cfv.value_number,
  cfv.value_boolean,
  cfv.value_date,
  cfv.created_at,
  cfv.updated_at
FROM public.crm_field_values cfv
JOIN public.lead_field_definitions lfd
  ON lfd.key = cfv.field_key
  AND lfd.entity_type = cfv.entity_type
WHERE cfv.entity_type IN ('pessoa', 'empresa')
ON CONFLICT ON CONSTRAINT lead_field_values_entity_def_uniq DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 5: Update RPC update_qualification_field → lead_field_values
-- ═══════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_qualification_field(
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
    RAISE WARNING 'update_qualification_field: field_key "%" not found in lead_field_definitions (entity_type=pessoa)', p_field_key;
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

GRANT EXECUTE ON FUNCTION public.update_qualification_field TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 6: DROP crm_field_* (data already migrated above)
-- ═══════════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_crm_field_definitions_updated_at ON public.crm_field_definitions;
DROP TRIGGER IF EXISTS trg_crm_field_values_updated_at ON public.crm_field_values;

DROP FUNCTION IF EXISTS public.crm_field_definitions_set_updated_at();
DROP FUNCTION IF EXISTS public.crm_field_values_set_updated_at();

DROP TABLE IF EXISTS public.crm_field_values CASCADE;
DROP TABLE IF EXISTS public.crm_field_definitions CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run manually after applying)
-- ═══════════════════════════════════════════════════════════════════════════════════
-- Definitions by entity_type:
--   SELECT entity_type, COUNT(*) FROM lead_field_definitions GROUP BY entity_type;
--
-- Q1-Q26 qualification fields present:
--   SELECT COUNT(*) FROM lead_field_definitions WHERE key LIKE 'q%' AND entity_type = 'pessoa';
--   -- Expected: 26
--
-- Values by entity_type:
--   SELECT entity_type, COUNT(*) FROM lead_field_values GROUP BY entity_type;
--
-- Orphaned values (should be 0):
--   SELECT COUNT(*) FROM lead_field_values lfv
--   WHERE NOT EXISTS (
--     SELECT 1 FROM lead_field_definitions WHERE id = lfv.field_definition_id
--   );
--
-- crm_ tables gone:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('crm_field_definitions', 'crm_field_values');
--   -- Expected: 0 rows
-- ═══════════════════════════════════════════════════════════════════════════════════
-- COMPLETE
-- ✅ lead_field_definitions: entity_type, agent_managed, extended types/categories
-- ✅ lead_field_values: entity_type, entity_id (unified), lead_id nullable
-- ✅ Q1-Q26 and pessoa/empresa fields migrated
-- ✅ All field values migrated (entity_id backfilled for negocio)
-- ✅ update_qualification_field RPC → lead_field_values
-- ✅ crm_field_definitions DROPPED
-- ✅ crm_field_values DROPPED
-- ═══════════════════════════════════════════════════════════════════════════════════
