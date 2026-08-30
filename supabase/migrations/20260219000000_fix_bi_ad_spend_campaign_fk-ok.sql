-- BI PRO™ — Fix bi_ad_spend FK and bi_ad_campaigns duplicate constraint
-- Root cause 1: PostgREST requires a declared FK to resolve joins via
--   .select('bi_ad_campaigns(campaign_name, utm_campaign)')
-- Root cause 2: bi_ad_campaigns had two overlapping unique constraints causing upsert failures
-- Root cause 3: bi_ad_campaigns.account_id was NOT NULL but edge function wasn't sending it
--
-- Applied to remote: 2026-02-19 via Management API (direct SQL execution)

-- 1. Clean up stale spend rows (from failed syncs)
DELETE FROM public.bi_ad_spend WHERE campaign_id IS NULL;
DELETE FROM public.bi_ad_spend
  WHERE campaign_id IS NOT NULL
    AND campaign_id NOT IN (SELECT id FROM public.bi_ad_campaigns);

-- 2. Drop redundant old unique constraint (conflicts with onConflict: 'platform,campaign_id')
--    The (platform, campaign_id) constraint is sufficient since Meta campaign IDs are globally unique
ALTER TABLE public.bi_ad_campaigns
  DROP CONSTRAINT IF EXISTS bi_ad_campaigns_account_id_campaign_id_key;

-- 3. Add FK so PostgREST can resolve the join in:
--    bi_ad_spend.select('spend, platform, ..., bi_ad_campaigns(campaign_name, utm_campaign)')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'bi_ad_spend'
      AND constraint_name = 'bi_ad_spend_campaign_id_fkey'
  ) THEN
    ALTER TABLE public.bi_ad_spend
      ADD CONSTRAINT bi_ad_spend_campaign_id_fkey
      FOREIGN KEY (campaign_id) REFERENCES public.bi_ad_campaigns(id) ON DELETE SET NULL;
  END IF;
END $$;
