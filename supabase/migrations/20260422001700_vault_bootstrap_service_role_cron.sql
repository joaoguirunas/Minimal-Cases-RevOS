-- SCH-H-3 bootstrap — seed Vault secret 'service_role_cron' programmatically.
-- This migration inserts the service_role JWT into Vault so that
-- migration 20260422001500 cron jobs can call secure_http_post() at runtime.
--
-- SECURITY NOTE: The JWT value here is the same one that was already in git
-- history (migrations 20260226301000 and 20260219140000). Rotation is the fix;
-- this migration only moves it from cron-job plaintext into Vault.
-- Rotate the JWT in Supabase Dashboard → Settings → API after applying.
--
-- Idempotent: skips insert if 'service_role_cron' already exists in vault.secrets.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'service_role_cron'
  ) THEN
    PERFORM vault.create_secret(
      'REPLACE_WITH_SERVICE_ROLE_JWT_FROM_VAULT',
      'service_role_cron',
      'Service role JWT for pg_cron secure_http_post calls — rotate after bootstrap'
    );
  END IF;
END $$;
