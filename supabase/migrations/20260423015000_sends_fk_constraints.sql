-- =============================================================================
-- CLEAN-SENDS-01: FK constraints for sends.template_id and stage_ids validation
-- =============================================================================

-- ── 1. FK: sends.template_id → whatsapp_templates.id ─────────────────────────
-- template_id is stored as text, not uuid — cast needed for FK.
-- Use ON DELETE SET NULL so deleting a template doesn't break existing sends;
-- the worker already handles null template gracefully.
ALTER TABLE public.sends
  ALTER COLUMN template_id TYPE uuid USING template_id::uuid;

ALTER TABLE public.sends
  ADD CONSTRAINT sends_template_id_fkey
  FOREIGN KEY (template_id)
  REFERENCES public.whatsapp_templates (id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.sends.template_id IS
  'FK → whatsapp_templates. NULL when template deleted or for non-WhatsApp channels.';

-- ── 2. Validation for stage_ids (array FK via CHECK + function) ───────────────
-- PostgreSQL does not support FK constraints on arrays natively.
-- We use a CHECK constraint backed by a SECURITY DEFINER function to validate
-- that all UUIDs in stage_ids exist in leads_stages.
-- The function returns true for NULL/empty arrays (not required).
CREATE OR REPLACE FUNCTION public.validate_stage_ids(p_stage_ids uuid[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_stage_ids IS NULL OR array_length(p_stage_ids, 1) IS NULL THEN
    RETURN true;
  END IF;

  -- All provided stage UUIDs must exist in leads_stages
  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(p_stage_ids) s(stage_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM leads_stages ls WHERE ls.id = s.stage_id
    )
  );
END;
$$;

COMMENT ON FUNCTION public.validate_stage_ids(uuid[]) IS
  'Validates that all UUIDs in an array exist in leads_stages. '
  'Used as CHECK constraint for sends.stage_ids.';

ALTER TABLE public.sends
  ADD CONSTRAINT sends_stage_ids_valid
  CHECK (public.validate_stage_ids(stage_ids));

COMMENT ON COLUMN public.sends.stage_ids IS
  'Array of stage UUIDs. All must exist in leads_stages (enforced via CHECK constraint).';
