-- Rollback for: 20260424012000_adm_releases.sql
-- Tested-against: pg15

BEGIN;
DROP TABLE IF EXISTS adm_releases CASCADE;
COMMIT;
