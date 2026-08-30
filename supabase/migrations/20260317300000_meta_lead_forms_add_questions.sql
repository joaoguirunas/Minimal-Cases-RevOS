-- MLF-05: Add raw_questions column to store Meta form questions for sync/mapping
ALTER TABLE meta_lead_forms
  ADD COLUMN IF NOT EXISTS raw_questions jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN meta_lead_forms.raw_questions IS 'Raw questions array from Meta Graph API — used for auto-mapping suggestions during sync';
