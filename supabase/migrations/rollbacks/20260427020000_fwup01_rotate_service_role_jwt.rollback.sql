-- FWUP-01 rollback
-- Removes the sync function and smoke-test function.
-- Does NOT restore the old JWT to _app_config — the old JWT was revoked.
-- If you are rolling back because the Vault secret is wrong, fix the Vault
-- secret and re-apply the migration instead of rolling back.
--
-- After rollback, _app_config.service_role_key will retain whatever value
-- the sync wrote (the new rotated JWT). That is intentional — do not restore
-- the old compromised JWT.

BEGIN;

DROP FUNCTION IF EXISTS public.trigger_fwup01_smoke_test();
DROP FUNCTION IF EXISTS public.sync_service_role_from_vault();

COMMIT;
