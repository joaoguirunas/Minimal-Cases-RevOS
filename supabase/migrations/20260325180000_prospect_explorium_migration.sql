-- ============================================================================
-- Prospect Pro v3 — Apify → Explorium (Vibe Prospecting) Migration
-- Story: prospect-v3.explorium-migration
-- ADDITIVE ONLY — no columns dropped, v1/v2 campaigns unaffected
-- ============================================================================

-- 1. Settings: explorium API key (per-tenant, same pattern as apify_token)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS explorium_api_key text;

-- 2. prospect_campaigns: provider tracking
ALTER TABLE prospect_campaigns
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'explorium',
  ADD COLUMN IF NOT EXISTS provider_config jsonb DEFAULT '{}';

-- New campaigns default to v3
ALTER TABLE prospect_campaigns ALTER COLUMN version SET DEFAULT 3;

-- 3. prospect_companies: explorium fields
ALTER TABLE prospect_companies
  ADD COLUMN IF NOT EXISTS explorium_business_id text,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS revenue_range text;

CREATE INDEX IF NOT EXISTS idx_pc_explorium_biz
  ON prospect_companies(explorium_business_id)
  WHERE explorium_business_id IS NOT NULL;

-- 4. prospect_people_v2: explorium fields
ALTER TABLE prospect_people_v2
  ADD COLUMN IF NOT EXISTS explorium_prospect_id text,
  ADD COLUMN IF NOT EXISTS job_level text;

CREATE INDEX IF NOT EXISTS idx_ppv2_explorium_pid
  ON prospect_people_v2(explorium_prospect_id)
  WHERE explorium_prospect_id IS NOT NULL;

-- 5. Update source check constraint to include 'explorium'
ALTER TABLE prospect_campaigns DROP CONSTRAINT IF EXISTS prospect_campaigns_source_check;
ALTER TABLE prospect_campaigns ADD CONSTRAINT prospect_campaigns_source_check
  CHECK (source IN ('google_maps', 'manual', 'linkedin', 'explorium'));

-- 6. Deprecate apify plugins
UPDATE prospect_enrichment_plugins
  SET provider = 'apify_deprecated'
  WHERE provider = 'apify';
