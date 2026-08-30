-- Rollback: restore constraint to pre-fix state (identity_collection only, no tldv)
-- NOTE: run this only if tldv_integration has not yet been applied.
ALTER TABLE public.omni_channel_configs
  DROP CONSTRAINT IF EXISTS omni_channel_configs_channel_check;

ALTER TABLE public.omni_channel_configs
  ADD CONSTRAINT omni_channel_configs_channel_check
  CHECK (channel IN ('whatsapp', 'instagram', 'email', 'sms', 'telefone', 'identity_collection'));
