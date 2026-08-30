-- ManyChat Instagram DM channel — adds `instagram-manychat` alongside `tiktok-manychat`
-- Same inbound function (tiktok-manychat-inbound) detects platform from payload fields.
-- Same API key + webhook secret shared across both channels.

BEGIN;

-- ── 1. messages_channel_check ─────────────────────────────────────────────────
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_channel_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_channel_check
  CHECK (channel = ANY (ARRAY[
    'whatsapp', 'instagram', 'email', 'sms', 'telefone',
    'tiktok', 'tiktok-manychat', 'instagram-manychat'
  ]));

-- ── 2. omni_channel_alerts_channel_check ─────────────────────────────────────
ALTER TABLE public.omni_channel_alerts
  DROP CONSTRAINT IF EXISTS omni_channel_alerts_channel_check;

ALTER TABLE public.omni_channel_alerts
  ADD CONSTRAINT omni_channel_alerts_channel_check
  CHECK (channel = ANY (ARRAY[
    'whatsapp', 'instagram', 'email', 'sms', 'telefone',
    'system', 'tiktok-manychat', 'instagram-manychat'
  ]));

-- ── 3. omni_channel_configs_channel_check ────────────────────────────────────
ALTER TABLE public.omni_channel_configs
  DROP CONSTRAINT IF EXISTS omni_channel_configs_channel_check;

ALTER TABLE public.omni_channel_configs
  ADD CONSTRAINT omni_channel_configs_channel_check
  CHECK (channel = ANY (ARRAY[
    'whatsapp', 'instagram', 'email', 'sms', 'telefone',
    'identity_collection', 'tldv', 'tiktok', 'tiktok-manychat', 'instagram-manychat'
  ]));

-- ── 4. Seed config row ────────────────────────────────────────────────────────
INSERT INTO public.omni_channel_configs (channel, display_name, credentials, is_active, webhook_fallback)
VALUES (
  'instagram-manychat',
  'Instagram (ManyChat)',
  '{"api_key": "", "webhook_secret": ""}',
  false,
  NULL
)
ON CONFLICT (channel) DO NOTHING;

COMMIT;
