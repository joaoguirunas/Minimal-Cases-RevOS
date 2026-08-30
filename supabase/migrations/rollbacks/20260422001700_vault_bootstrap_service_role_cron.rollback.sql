-- Rollback: remove the bootstrapped Vault secret.
-- Only removes if it exists; safe to run multiple times.
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'service_role_cron';
  IF v_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_id;
  END IF;
END $$;
