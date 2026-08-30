-- Rollback for: 20260424013000_adm_client_versions.sql
-- Tested-against: pg15

BEGIN;
DROP TABLE IF EXISTS adm_client_versions CASCADE;
COMMIT;
