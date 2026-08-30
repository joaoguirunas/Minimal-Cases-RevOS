-- TIKTOK-01: Ensure 'tiktok' is a valid channel value
--
-- Idempotent reassertion of the channel CHECK constraints on
-- omni_channel_configs and messages. The live database already includes
-- 'tiktok' (applied by 20260413230000_tiktok_integration), but the migration
-- file history drifted: 20260421000000 recreated the omni_channel_configs
-- constraint WITHOUT 'tiktok' and added 'tldv'. This migration converges both
-- constraints to the full superset of all valid channels so that files and the
-- live schema agree. No existing rows use 'tldv' or 'tiktok', so DROP + ADD is
-- lossless.

ALTER TABLE public.omni_channel_configs
  DROP CONSTRAINT IF EXISTS omni_channel_configs_channel_check;

ALTER TABLE public.omni_channel_configs
  ADD CONSTRAINT omni_channel_configs_channel_check
  CHECK (channel IN (
    'whatsapp',
    'instagram',
    'email',
    'sms',
    'telefone',
    'identity_collection',
    'tldv',
    'tiktok'
  ));

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_channel_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_channel_check
  CHECK (channel IN (
    'whatsapp',
    'instagram',
    'email',
    'sms',
    'telefone',
    'tiktok'
  ));
