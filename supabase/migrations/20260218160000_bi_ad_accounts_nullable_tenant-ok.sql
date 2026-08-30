-- BI PRO™ — Make tenant_id nullable in bi_ad_accounts
-- The table was originally created (via dashboard) with tenant_id NOT NULL,
-- but the intended design is single-tenant (no tenant_id required).
-- This aligns the remote with the local migration 20260217_bipro_ad_tables.sql.
-- Created: 2026-02-18

ALTER TABLE public.bi_ad_accounts
  ALTER COLUMN tenant_id DROP NOT NULL;
