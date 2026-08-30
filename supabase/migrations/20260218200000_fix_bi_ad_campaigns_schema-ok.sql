-- BI PRO™ — Fix bi_ad_campaigns remote schema mismatch
-- The remote table was created via Supabase dashboard with a different schema
-- than what the edge functions (bi-sync-meta-ads, bi-sync-google-ads) and
-- the frontend hooks expect. This migration aligns the remote schema.
-- Created: 2026-02-18

-- 1. Add ad_account_id column (edge functions write with this name, remote had 'account_id')
ALTER TABLE public.bi_ad_campaigns
  ADD COLUMN IF NOT EXISTS ad_account_id uuid REFERENCES public.bi_ad_accounts(id) ON DELETE CASCADE;

-- 2. Populate ad_account_id from existing account_id column (for any existing rows)
UPDATE public.bi_ad_campaigns
  SET ad_account_id = account_id
  WHERE ad_account_id IS NULL AND account_id IS NOT NULL;

-- 3. Add platform column (critical: used in edge function upsert + channel attribution)
ALTER TABLE public.bi_ad_campaigns
  ADD COLUMN IF NOT EXISTS platform text;

-- 4. Populate platform from bi_ad_accounts for any existing rows
UPDATE public.bi_ad_campaigns c
  SET platform = a.platform
  FROM public.bi_ad_accounts a
  WHERE (c.ad_account_id = a.id OR c.account_id = a.id)
    AND c.platform IS NULL;

-- 5. Default remaining NULLs to 'meta' (existing campaigns are most likely Meta)
UPDATE public.bi_ad_campaigns
  SET platform = 'meta'
  WHERE platform IS NULL;

-- 6. Add utm_campaign column (for matching campaigns to leads.utm_campaign)
ALTER TABLE public.bi_ad_campaigns
  ADD COLUMN IF NOT EXISTS utm_campaign text;

-- 7. Add unique constraint on (platform, campaign_id) — required for ON CONFLICT upserts
--    First remove any duplicates that would block it
DELETE FROM public.bi_ad_campaigns c1
  USING public.bi_ad_campaigns c2
  WHERE c1.ctid > c2.ctid
    AND c1.campaign_id = c2.campaign_id
    AND c1.platform = c2.platform;

DROP INDEX IF EXISTS bi_ad_campaigns_platform_campaign_id_unique;
ALTER TABLE public.bi_ad_campaigns
  DROP CONSTRAINT IF EXISTS bi_ad_campaigns_platform_campaign_id_key;
ALTER TABLE public.bi_ad_campaigns
  ADD CONSTRAINT bi_ad_campaigns_platform_campaign_id_key UNIQUE (platform, campaign_id);

-- 8. Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_bi_ad_campaigns_platform
  ON public.bi_ad_campaigns (platform);

CREATE INDEX IF NOT EXISTS idx_bi_ad_campaigns_utm_campaign
  ON public.bi_ad_campaigns (utm_campaign)
  WHERE utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bi_ad_campaigns_ad_account
  ON public.bi_ad_campaigns (ad_account_id)
  WHERE ad_account_id IS NOT NULL;

-- 9. Remove orphaned bi_ad_spend rows with campaign_id=NULL
--    These were inserted when campaign upserts were failing silently.
--    After re-syncing, correct rows (with valid campaign_id) will be inserted.
DELETE FROM public.bi_ad_spend WHERE campaign_id IS NULL;
