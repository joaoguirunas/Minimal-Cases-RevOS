-- ══════════════════════════════════════════════════════════════════════════════
-- TikTok Integration — Schema Migration
-- Tasks: T-01, T-02, T-03, T-04, T-05
-- ══════════════════════════════════════════════════════════════════════════════

-- ── T-01: omni_channel_configs.channel — add 'tiktok' ────────────────────────
ALTER TABLE omni_channel_configs
  DROP CONSTRAINT IF EXISTS omni_channel_configs_channel_check;

ALTER TABLE omni_channel_configs
  ADD CONSTRAINT omni_channel_configs_channel_check
  CHECK (channel IN ('whatsapp', 'instagram', 'email', 'sms', 'telefone', 'identity_collection', 'tiktok'));

-- ── T-02: messages.channel — add 'tiktok' ────────────────────────────────────
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_channel_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_channel_check
  CHECK (channel IN ('whatsapp', 'instagram', 'email', 'sms', 'telefone', 'tiktok'));

-- ── T-03: clients_people.tiktok_open_id ──────────────────────────────────────
ALTER TABLE clients_people
  ADD COLUMN IF NOT EXISTS tiktok_open_id text;

CREATE INDEX IF NOT EXISTS idx_clients_people_tiktok_open_id
  ON clients_people(tiktok_open_id)
  WHERE tiktok_open_id IS NOT NULL;

-- ── T-04: bi_settings — TikTok Ads columns ───────────────────────────────────
ALTER TABLE bi_settings
  ADD COLUMN IF NOT EXISTS tiktok_app_id             text,
  ADD COLUMN IF NOT EXISTS tiktok_app_secret         text,
  ADD COLUMN IF NOT EXISTS tiktok_access_token       text,
  ADD COLUMN IF NOT EXISTS tiktok_refresh_token      text,
  ADD COLUMN IF NOT EXISTS tiktok_token_expires_at   timestamptz,
  ADD COLUMN IF NOT EXISTS tiktok_ad_account_ids     text[];

-- ── T-05: CREATE TABLE bi_tiktok_ad_spend ────────────────────────────────────
CREATE TABLE IF NOT EXISTS bi_tiktok_ad_spend (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date        NOT NULL,
  advertiser_id   text        NOT NULL,
  advertiser_name text,
  campaign_id     text,
  campaign_name   text,
  adgroup_id      text,
  adgroup_name    text,
  spend           numeric(12,4) DEFAULT 0,
  spend_brl       numeric(12,4),
  impressions     int           DEFAULT 0,
  clicks          int           DEFAULT 0,
  cpc             numeric(10,4),
  cpm             numeric(10,4),
  ctr             numeric(6,4),
  conversions     int           DEFAULT 0,
  created_at      timestamptz   DEFAULT now(),
  updated_at      timestamptz   DEFAULT now(),
  UNIQUE(date, advertiser_id, campaign_id, adgroup_id)
);

ALTER TABLE bi_tiktok_ad_spend ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_access" ON bi_tiktok_ad_spend;
CREATE POLICY "tenant_access" ON bi_tiktok_ad_spend USING (true);

CREATE INDEX IF NOT EXISTS idx_bi_tiktok_ad_spend_date
  ON bi_tiktok_ad_spend(date);

CREATE INDEX IF NOT EXISTS idx_bi_tiktok_ad_spend_campaign
  ON bi_tiktok_ad_spend(campaign_id);
