-- Extend action_token_consumed for ADR-SP-02 full schema
-- consumeAction.ts inserts resource_id, tenant_id, token_exp — add those columns.
-- meeting_id is kept for backward compat (existing data) but resource_id is canonical going forward.

BEGIN;

ALTER TABLE public.action_token_consumed
  ADD COLUMN IF NOT EXISTS resource_id text,
  ADD COLUMN IF NOT EXISTS tenant_id   text,
  ADD COLUMN IF NOT EXISTS token_exp   timestamptz;

COMMIT;
