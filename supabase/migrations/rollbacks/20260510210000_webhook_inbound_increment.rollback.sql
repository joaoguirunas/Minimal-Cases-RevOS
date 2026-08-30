-- Rollback for: 20260510210000_webhook_inbound_increment.sql
-- Tested-against: pg15
-- Reverts the additive columns create_mode + trigger_config from inbound_webhooks.

BEGIN;

ALTER TABLE public.inbound_webhooks
  DROP CONSTRAINT IF EXISTS inbound_webhooks_create_mode_check;

ALTER TABLE public.inbound_webhooks
  DROP COLUMN IF EXISTS create_mode;

ALTER TABLE public.inbound_webhooks
  DROP COLUMN IF EXISTS trigger_config;

COMMIT;
