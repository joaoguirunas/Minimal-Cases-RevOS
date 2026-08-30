-- Backfill: move form_id → meta_form_id for existing meta submissions
UPDATE form_pro_submissions
  SET meta_form_id = form_id, form_id = NULL
  WHERE source = 'meta' AND form_id IS NOT NULL AND meta_form_id IS NULL;
