-- Rollback: remove columns added by 20260422001600
BEGIN;

ALTER TABLE public.action_token_consumed
  DROP COLUMN IF EXISTS resource_id,
  DROP COLUMN IF EXISTS tenant_id,
  DROP COLUMN IF EXISTS token_exp;

COMMIT;
