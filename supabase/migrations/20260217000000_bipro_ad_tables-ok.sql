-- BI PRO™ — Tabelas de Integração com Ads (Meta + Google)
-- BIPRO-1.1: Foundation schema for ad spend tracking and CAC calculation
-- Created: 2026-02-17
-- Fixed: 2026-02-17 — Use settings_users / is_admin_or_gestor(), removed tenant_id (single-tenant)

-- =============================================================================
-- TABLE: bi_ad_accounts
-- Stores connected ad platform accounts (Meta Ads, Google Ads)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bi_ad_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        text NOT NULL CHECK (platform IN ('meta', 'google')),
  account_id      text NOT NULL,
  account_name    text NOT NULL,
  access_token    text,               -- Stored encrypted at application level
  refresh_token   text,               -- Stored encrypted at application level
  token_expires_at timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  last_sync_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, account_id)
);

-- Index for lookups by platform
CREATE INDEX IF NOT EXISTS idx_bi_ad_accounts_platform
  ON public.bi_ad_accounts(platform);

-- RLS
ALTER TABLE public.bi_ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bi_ad_accounts_all"
  ON public.bi_ad_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- TABLE: bi_ad_campaigns
-- Stores campaign metadata from connected ad platforms
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bi_ad_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id   uuid NOT NULL REFERENCES public.bi_ad_accounts(id) ON DELETE CASCADE,
  platform        text NOT NULL CHECK (platform IN ('meta', 'google')),
  campaign_id     text NOT NULL,       -- ID na plataforma (Meta/Google)
  campaign_name   text NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'deleted')),
  objective       text,                -- awareness, traffic, leads, conversions, etc.
  utm_campaign    text,                -- Para matching com leads.utm_campaign
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, campaign_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bi_ad_campaigns_platform
  ON public.bi_ad_campaigns(platform);

CREATE INDEX IF NOT EXISTS idx_bi_ad_campaigns_utm
  ON public.bi_ad_campaigns(utm_campaign)
  WHERE utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bi_ad_campaigns_account
  ON public.bi_ad_campaigns(ad_account_id);

-- RLS
ALTER TABLE public.bi_ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bi_ad_campaigns_all"
  ON public.bi_ad_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- TABLE: bi_ad_spend
-- Daily ad spend records per campaign — core data for CAC calculation
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bi_ad_spend (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id   uuid NOT NULL REFERENCES public.bi_ad_accounts(id) ON DELETE CASCADE,
  campaign_id     uuid REFERENCES public.bi_ad_campaigns(id) ON DELETE SET NULL,
  platform        text NOT NULL CHECK (platform IN ('meta', 'google')),
  date            date NOT NULL,
  spend           numeric(12, 2) NOT NULL DEFAULT 0,   -- Gasto em R$ (ou moeda local)
  impressions     integer,
  clicks          integer,
  leads           integer,           -- Leads registrados pela plataforma
  currency        text NOT NULL DEFAULT 'BRL',
  raw_data        jsonb,             -- Dados brutos da API para auditoria
  source          text DEFAULT 'api' CHECK (source IN ('api', 'csv')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, date)
);

-- Indexes for date-range queries (most common BI query pattern)
CREATE INDEX IF NOT EXISTS idx_bi_ad_spend_date
  ON public.bi_ad_spend(date DESC);

CREATE INDEX IF NOT EXISTS idx_bi_ad_spend_campaign_date
  ON public.bi_ad_spend(campaign_id, date DESC)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bi_ad_spend_account_date
  ON public.bi_ad_spend(ad_account_id, date DESC);

-- RLS
ALTER TABLE public.bi_ad_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bi_ad_spend_all"
  ON public.bi_ad_spend FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- FUNCTION: update_bi_ad_tables_updated_at
-- Auto-update updated_at on bi_ad_accounts and bi_ad_campaigns
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_bi_ad_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bi_ad_accounts_updated_at
  BEFORE UPDATE ON public.bi_ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_bi_ad_tables_updated_at();

CREATE TRIGGER trg_bi_ad_campaigns_updated_at
  BEFORE UPDATE ON public.bi_ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_bi_ad_tables_updated_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE public.bi_ad_accounts IS 'BI PRO™: Connected ad platform accounts (Meta Ads, Google Ads)';
COMMENT ON TABLE public.bi_ad_campaigns IS 'BI PRO™: Ad campaign metadata with UTM matching support';
COMMENT ON TABLE public.bi_ad_spend IS 'BI PRO™: Daily ad spend records for CAC calculation';
COMMENT ON COLUMN public.bi_ad_spend.spend IS 'Ad spend amount in local currency (default BRL)';
COMMENT ON COLUMN public.bi_ad_campaigns.utm_campaign IS 'UTM campaign value for matching with leads.utm_campaign';
