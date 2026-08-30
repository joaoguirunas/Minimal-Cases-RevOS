-- Reverts 20260312170000_ensure_crm_tenants_baseline.sql
-- WARNING: Only safe to run if crm_tenants has no data and no dependents.
-- On existing tenants this table was already present before this migration — do not drop.

-- DO NOT execute on production tenants that already had crm_tenants before this migration.
-- This rollback is provided for new tenants only (dev/test environments).

-- DROP TABLE IF EXISTS public.crm_tenants CASCADE;
