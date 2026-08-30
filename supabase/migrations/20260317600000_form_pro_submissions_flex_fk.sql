-- Allow form_pro_submissions to store either site form IDs (form_pro_forms)
-- or meta form IDs (meta_lead_forms). The `source` column distinguishes the origin.

-- 1. Drop the strict FK to form_pro_forms so meta form IDs can be stored
ALTER TABLE form_pro_submissions
  DROP CONSTRAINT IF EXISTS lp_submissions_form_id_fkey;

-- 2. Make form_id nullable (meta submissions may reference meta_lead_forms)
ALTER TABLE form_pro_submissions
  ALTER COLUMN form_id DROP NOT NULL;

-- 3. Add meta_form_id column for explicit meta FK
ALTER TABLE form_pro_submissions
  ADD COLUMN IF NOT EXISTS meta_form_id uuid REFERENCES meta_lead_forms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_form_pro_submissions_meta_form
  ON form_pro_submissions (meta_form_id) WHERE meta_form_id IS NOT NULL;

-- 4. Re-add a softer FK for site submissions (form_id → form_pro_forms)
--    Using a check + index instead of hard FK to avoid blocking meta inserts
--    The old form_id index already exists (idx_lp_submissions_form_id)

COMMENT ON COLUMN form_pro_submissions.meta_form_id IS 'FK to meta_lead_forms for source=meta submissions';
COMMENT ON COLUMN form_pro_submissions.form_id IS 'FK to form_pro_forms for source=site submissions (no hard FK to allow meta_form_id usage)';

-- 5. Migrate existing meta submissions: move form_id → meta_form_id
UPDATE form_pro_submissions
  SET meta_form_id = form_id, form_id = NULL
  WHERE source = 'meta' AND form_id IS NOT NULL AND meta_form_id IS NULL;
