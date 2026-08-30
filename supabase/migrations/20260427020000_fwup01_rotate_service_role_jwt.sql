-- FWUP-01: Rotate service_role JWT + sync _app_config from Vault
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- CONTEXT:
--   Migrations 20260226301000, 20260219140000, 20260307100000, and 20260422001700
--   contain a service_role JWT in plaintext. That JWT is compromised.
--
-- PREREQUISITES (manual steps BEFORE applying this migration):
--
--   1. Supabase Dashboard → Settings → API → Regenerate service_role key
--      (copy the new JWT — you will need it in step 2)
--
--   2. Supabase Vault → Update secret 'service_role_cron':
--        vault.secrets WHERE name = 'service_role_cron'
--      Update the value to the new JWT from step 1.
--      If the secret does not exist yet, create it:
--        SELECT vault.create_secret('<new-jwt>', 'service_role_cron', 'Service role JWT for pg_cron — rotated FWUP-01');
--
--   3. Apply THIS migration (supabase db push or migration apply).
--
--   4. Validate: SELECT trigger_fwup01_smoke_test();
--
-- WHAT THIS MIGRATION DOES:
--   a) Defines sync_service_role_from_vault() — reads from vault.decrypted_secrets
--      and updates _app_config.service_role_key with the current Vault value.
--      This decouples _app_config from hardcoded values permanently.
--   b) Calls sync_service_role_from_vault() immediately on apply.
--      After rotation (step 1+2 above), this migration replaces the old
--      plaintext JWT in _app_config with the new rotated value from Vault.
--   c) Logs the rotation in secret_access_log with context 'fwup01-rotation'.
--   d) Provides trigger_fwup01_smoke_test() for post-rotation validation.
--
-- NOTE ON GIT HISTORY:
--   Files 20260226301000 and 20260219140000 in git history cannot be removed
--   without rewriting history. The security fix is key rotation (step 1), not
--   file deletion. The old JWT is invalidated by rotation — historical presence
--   in git is not exploitable after rotation.
--
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Function: sync _app_config.service_role_key from Vault ─────────────────

CREATE OR REPLACE FUNCTION public.sync_service_role_from_vault()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_key text;
BEGIN
  SELECT decrypted_secret INTO v_new_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_cron'
  LIMIT 1;

  IF v_new_key IS NULL THEN
    RAISE EXCEPTION 'FWUP-01: Vault secret service_role_cron not found. '
      'Create it in Supabase Dashboard → Vault before applying this migration.';
  END IF;

  -- Update _app_config with the Vault value (idempotent)
  INSERT INTO public._app_config (key, value)
  VALUES ('service_role_key', v_new_key)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  -- Audit log
  INSERT INTO public.secret_access_log (secret_name, caller_context)
  VALUES ('service_role_cron', 'fwup01-rotation');

  RAISE NOTICE 'FWUP-01: _app_config.service_role_key synced from Vault (service_role_cron).';
END;
$$;

COMMENT ON FUNCTION public.sync_service_role_from_vault() IS
  'FWUP-01: Reads service_role JWT from vault.decrypted_secrets (name=service_role_cron) '
  'and updates _app_config.service_role_key. Call after each JWT rotation.';

-- Only service_role may call this
REVOKE ALL ON FUNCTION public.sync_service_role_from_vault() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_service_role_from_vault() TO service_role;


-- ── 2. Apply sync immediately (rotation takes effect on migration apply) ───────

DO $fwup01_apply$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_app_config'
  ) THEN
    PERFORM public.sync_service_role_from_vault();
  ELSE
    RAISE NOTICE 'FWUP-01: _app_config não existe ainda — sync ignorado. Será executado após adm-sync-client semear _app_config.';
  END IF;
END $fwup01_apply$;


-- ── 3. Smoke-test function (call after apply to validate end-to-end) ──────────

CREATE OR REPLACE FUNCTION public.trigger_fwup01_smoke_test()
RETURNS TABLE(check_name text, status text, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_key   text;
  v_config_key  text;
BEGIN
  -- Check 1: Vault secret exists
  SELECT decrypted_secret INTO v_vault_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_cron' LIMIT 1;

  check_name := 'vault_secret_exists';
  status     := CASE WHEN v_vault_key IS NOT NULL THEN 'PASS' ELSE 'FAIL' END;
  detail     := CASE WHEN v_vault_key IS NOT NULL
                  THEN 'service_role_cron found in vault (' || length(v_vault_key) || ' chars)'
                  ELSE 'service_role_cron NOT FOUND in vault.decrypted_secrets' END;
  RETURN NEXT;

  -- Check 2: _app_config matches Vault
  SELECT value INTO v_config_key FROM public._app_config WHERE key = 'service_role_key' LIMIT 1;

  check_name := 'app_config_synced';
  status     := CASE WHEN v_config_key = v_vault_key THEN 'PASS' ELSE 'FAIL' END;
  detail     := CASE
    WHEN v_config_key IS NULL THEN '_app_config missing service_role_key row'
    WHEN v_config_key = v_vault_key THEN '_app_config.service_role_key matches Vault'
    ELSE '_app_config.service_role_key DIFFERS from Vault — sync failed'
  END;
  RETURN NEXT;

  -- Check 3: cron job 'process-meeting-followups' uses secure_http_post
  check_name := 'cron_uses_secure_http_post';
  status     := CASE
    WHEN EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'process-meeting-followups'
        AND command LIKE '%secure_http_post%'
    ) THEN 'PASS' ELSE 'FAIL'
  END;
  detail     := CASE
    WHEN EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'process-meeting-followups'
        AND command LIKE '%secure_http_post%'
    ) THEN 'process-meeting-followups uses secure_http_post (no JWT literal)'
    ELSE 'process-meeting-followups cron NOT found or still using JWT literal'
  END;
  RETURN NEXT;

  -- Check 4: No JWT literal in active cron commands
  check_name := 'no_jwt_in_cron_commands';
  DECLARE
    v_count int;
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM cron.job
    WHERE command ~ 'eyJ[A-Za-z0-9_\-]{30,}';

    status := CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END;
    detail := CASE WHEN v_count = 0
      THEN 'No JWT literals found in active cron.job commands'
      ELSE v_count || ' cron job(s) still contain JWT literals — check cron.job table'
    END;
  END;
  RETURN NEXT;

  -- Check 5: Rotation logged in secret_access_log
  check_name := 'rotation_audit_logged';
  status     := CASE
    WHEN EXISTS (
      SELECT 1 FROM public.secret_access_log
      WHERE secret_name = 'service_role_cron'
        AND caller_context = 'fwup01-rotation'
    ) THEN 'PASS' ELSE 'WARN'
  END;
  detail     := CASE
    WHEN EXISTS (
      SELECT 1 FROM public.secret_access_log
      WHERE secret_name = 'service_role_cron'
        AND caller_context = 'fwup01-rotation'
    ) THEN 'Rotation logged in secret_access_log'
    ELSE 'No rotation log entry found — secret_access_log may be missing'
  END;
  RETURN NEXT;

END;
$$;

COMMENT ON FUNCTION public.trigger_fwup01_smoke_test() IS
  'FWUP-01 post-rotation validator. Returns one row per check with PASS/FAIL/WARN. '
  'All checks should be PASS after rotation + migration apply.';

REVOKE ALL ON FUNCTION public.trigger_fwup01_smoke_test() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_fwup01_smoke_test() TO service_role;

COMMIT;
