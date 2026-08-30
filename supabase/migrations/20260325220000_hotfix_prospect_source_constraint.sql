-- HOTFIX: Update prospect_campaigns source constraint to include 'explorium'
ALTER TABLE prospect_campaigns DROP CONSTRAINT IF EXISTS prospect_campaigns_source_check;
ALTER TABLE prospect_campaigns ADD CONSTRAINT prospect_campaigns_source_check CHECK (source IN ('google_maps', 'manual', 'linkedin', 'explorium'));
