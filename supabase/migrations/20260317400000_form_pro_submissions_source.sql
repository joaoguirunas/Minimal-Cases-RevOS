-- MLF-06: Add source column to identify Site vs Meta submissions
ALTER TABLE form_pro_submissions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'site';

ALTER TABLE form_pro_submissions
  ADD CONSTRAINT form_pro_submissions_source_check
  CHECK (source IN ('site', 'meta'));

COMMENT ON COLUMN form_pro_submissions.source IS 'Origin: site (Form Site / lp-submit) or meta (Meta Lead Ads / webhook)';

-- Index for source filter queries
CREATE INDEX IF NOT EXISTS idx_form_pro_submissions_source
  ON form_pro_submissions (source);
