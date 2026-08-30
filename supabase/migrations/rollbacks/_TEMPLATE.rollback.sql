-- Rollback for: {YYYYMMDDHHMMSS_description}.sql
-- Tested-against: pg15
-- Instructions: replace this template with SQL that REVERTS the corresponding migration.
--   If main migration does CREATE TABLE foo → rollback does DROP TABLE IF EXISTS foo CASCADE
--   If main migration does ADD COLUMN bar → rollback does ALTER TABLE ... DROP COLUMN IF EXISTS bar
--   If main migration does CREATE INDEX → rollback does DROP INDEX IF EXISTS

BEGIN;

-- TODO: add rollback SQL here

COMMIT;
