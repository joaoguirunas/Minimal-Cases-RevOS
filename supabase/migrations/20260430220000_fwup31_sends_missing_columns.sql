-- FWUP-31: Adds missing sends columns for tenants created from the baseline.
-- phase_consolidation (20260223) and sends_wa_channel (20260302200000) were never
-- added to client-migrations.json, so new tenants (e.g. ORA) are missing:
-- channel, type, failed_count, send_interval_seconds, webhook_id, filter_config,
-- wa_channel_id, message_content.

ALTER TABLE public.sends
  ADD COLUMN IF NOT EXISTS channel               text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS type                  text NOT NULL DEFAULT 'filtered',
  ADD COLUMN IF NOT EXISTS failed_count          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS send_interval_seconds integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS webhook_id            uuid,
  ADD COLUMN IF NOT EXISTS filter_config         jsonb,
  ADD COLUMN IF NOT EXISTS wa_channel_id         uuid,
  ADD COLUMN IF NOT EXISTS message_content       text,
  ADD COLUMN IF NOT EXISTS last_batch_at         timestamptz;

-- Check constraints (idempotent)
ALTER TABLE public.sends
  DROP CONSTRAINT IF EXISTS sends_channel_check;
ALTER TABLE public.sends
  ADD CONSTRAINT sends_channel_check
  CHECK (channel IN ('whatsapp', 'email', 'sms', 'phone'));

ALTER TABLE public.sends
  DROP CONSTRAINT IF EXISTS sends_type_check;
ALTER TABLE public.sends
  ADD CONSTRAINT sends_type_check
  CHECK (type IN ('imported', 'filtered'));

ALTER TABLE public.sends
  DROP CONSTRAINT IF EXISTS sends_interval_check;
ALTER TABLE public.sends
  ADD CONSTRAINT sends_interval_check
  CHECK (send_interval_seconds IN (5, 10, 30, 60, 300, 600, 1800, 3600));

-- FK: sends.wa_channel_id → settings_whatsapp_channels
ALTER TABLE public.sends
  DROP CONSTRAINT IF EXISTS sends_wa_channel_id_fkey;
ALTER TABLE public.sends
  ADD CONSTRAINT sends_wa_channel_id_fkey
  FOREIGN KEY (wa_channel_id)
  REFERENCES public.settings_whatsapp_channels(id)
  ON DELETE SET NULL;

-- FK: sends.webhook_id → webhooks
ALTER TABLE public.sends
  DROP CONSTRAINT IF EXISTS fk_sends_webhook;
ALTER TABLE public.sends
  ADD CONSTRAINT fk_sends_webhook
  FOREIGN KEY (webhook_id)
  REFERENCES public.webhooks(id)
  ON DELETE SET NULL;
