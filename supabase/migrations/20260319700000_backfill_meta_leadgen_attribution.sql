-- ============================================================
-- Backfill: Meta Lead Ad attribution for pre-existing submissions
--
-- Problem: Leads imported via Meta Lead Ads BEFORE the conversion_tracking_schema
-- migration (20260318800000) have meta_leadgen_id = NULL in form_pro_submissions
-- and fb_lead_id = NULL in leads. The BI PRO attribution hook relies on these
-- columns to detect Meta Lead Ad leads and assign them to campaigns.
--
-- Signal: The webhook (meta-inbound) ALWAYS stored _source and _leadgen_id
-- inside the jsonb `data` column, even before dedicated columns existed.
--
-- This migration:
--   1. Fixes source='site' → 'meta' for Meta Lead Ad submissions
--   2. Populates meta_leadgen_id from data->>'_leadgen_id'
--   3. Propagates fb_lead_id to the associated leads record
-- ============================================================

-- Step 1: Fix source column for Meta submissions that defaulted to 'site'
UPDATE form_pro_submissions
SET source = 'meta'
WHERE source = 'site'
  AND data->>'_source' = 'meta';

-- Step 2: Backfill meta_leadgen_id from jsonb data
UPDATE form_pro_submissions
SET meta_leadgen_id = data->>'_leadgen_id'
WHERE meta_leadgen_id IS NULL
  AND data->>'_leadgen_id' IS NOT NULL
  AND data->>'_leadgen_id' != '';

-- Step 3: Propagate fb_lead_id to leads that don't have it yet
-- Uses the submission's meta_leadgen_id as the fb_lead_id value
UPDATE leads l
SET fb_lead_id = fps.meta_leadgen_id,
    lead_source = 'meta_lead_ad'
FROM form_pro_submissions fps
WHERE fps.lead_id = l.id
  AND fps.meta_leadgen_id IS NOT NULL
  AND l.fb_lead_id IS NULL;
