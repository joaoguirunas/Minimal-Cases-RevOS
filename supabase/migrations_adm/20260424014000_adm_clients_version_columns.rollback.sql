-- Rollback for: 20260424014000_adm_clients_version_columns.sql
-- Tested-against: pg15

BEGIN;
ALTER TABLE adm_clients
  DROP COLUMN IF EXISTS current_version,
  DROP COLUMN IF EXISTS target_version;
COMMIT;
