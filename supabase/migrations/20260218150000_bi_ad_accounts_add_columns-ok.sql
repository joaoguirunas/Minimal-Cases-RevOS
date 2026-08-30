-- BI PRO™ — Add missing columns to bi_ad_accounts
-- The table was created before these columns were added to the schema.
-- Using ADD COLUMN IF NOT EXISTS to be idempotent.
-- Created: 2026-02-18

ALTER TABLE public.bi_ad_accounts
  ADD COLUMN IF NOT EXISTS access_token      text,
  ADD COLUMN IF NOT EXISTS refresh_token     text,
  ADD COLUMN IF NOT EXISTS token_expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS is_active         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_sync_at      timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();
