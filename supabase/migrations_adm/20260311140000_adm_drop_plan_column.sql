-- Add db_password (was in code but missing from DB)
-- Drop plan (no business logic attached)
ALTER TABLE adm_clients ADD COLUMN IF NOT EXISTS db_password text;
ALTER TABLE adm_clients DROP COLUMN IF EXISTS plan;
