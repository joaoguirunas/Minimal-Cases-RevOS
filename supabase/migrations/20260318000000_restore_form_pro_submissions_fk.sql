-- Re-add FK from form_pro_submissions.form_id → form_pro_forms.id
-- PostgREST needs this FK to resolve joins like form_pro_forms(name, fields).
-- The FK is nullable so meta submissions (form_id = NULL) are unaffected.

ALTER TABLE form_pro_submissions
  ADD CONSTRAINT form_pro_submissions_form_id_fkey
  FOREIGN KEY (form_id) REFERENCES form_pro_forms(id) ON DELETE SET NULL;
