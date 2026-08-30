-- FIX: omni_channel_configs.channel CHECK constraint consolidation
-- Migration 20260421180000_tldv_integration drops and recreates the channel CHECK
-- omitting 'identity_collection' added by 20260315200000_identity_collection_optout.
-- This migration runs first (order_index 112.5→ between 112 and 113) to ensure
-- the CHECK includes all valid values before tldv_integration modifies it again.
-- Both migrations use DROP IF EXISTS + ADD, so this is safe to run before either.

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
    'tldv'
  ));
