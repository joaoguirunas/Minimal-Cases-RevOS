-- wh-02: Increment in inbound_webhooks for create_mode + trigger_config support.
-- Adds two additive columns; no data migration required.
-- create_mode controls dedup/upsert behavior on payload arrival.
-- trigger_config holds optional auto-dispatch config (template, channel, delay).

BEGIN;

-- 1. create_mode: TEXT + CHECK (lighter than enum for single-tenant evolvability)
ALTER TABLE public.inbound_webhooks
  ADD COLUMN IF NOT EXISTS create_mode TEXT NOT NULL DEFAULT 'criar';

ALTER TABLE public.inbound_webhooks
  DROP CONSTRAINT IF EXISTS inbound_webhooks_create_mode_check;

ALTER TABLE public.inbound_webhooks
  ADD CONSTRAINT inbound_webhooks_create_mode_check
  CHECK (create_mode IN ('criar', 'criar_se_nao_existir', 'atualizar_etapa', 'somente_etapa'));

-- 2. trigger_config: JSONB nullable (no default — NULL = no auto-dispatch)
ALTER TABLE public.inbound_webhooks
  ADD COLUMN IF NOT EXISTS trigger_config JSONB;

COMMENT ON COLUMN public.inbound_webhooks.create_mode IS
  'Controla comportamento ao receber payload: criar | criar_se_nao_existir | atualizar_etapa | somente_etapa';

COMMENT ON COLUMN public.inbound_webhooks.trigger_config IS
  'Disparo automatico opcional. JSONB shape: {enabled, template_id, template_name, channel, delay_minutes}. NULL = desabilitado.';

COMMIT;
