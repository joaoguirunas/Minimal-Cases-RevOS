-- Identity Collection (Story omni-identity.5)
-- 1. Adds opt-out flag to prevent proactive identity collection for opted-out contacts.
-- 2. Seeds identity_collection config row in omni_channel_configs.

ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS identity_collection_opted_out BOOLEAN DEFAULT false;

-- Expand channel CHECK to include identity_collection
ALTER TABLE public.omni_channel_configs
  DROP CONSTRAINT IF EXISTS omni_channel_configs_channel_check;
ALTER TABLE public.omni_channel_configs
  ADD CONSTRAINT omni_channel_configs_channel_check
    CHECK (channel IN ('whatsapp', 'instagram', 'email', 'sms', 'telefone', 'identity_collection'));

-- Config row for identity collection settings
INSERT INTO public.omni_channel_configs (channel, is_active, display_name, credentials, settings, webhook_fallback, business_hours)
VALUES (
  'identity_collection',
  true,
  'Coleta de Identidade',
  '{}'::jsonb,
  '{
    "wa_to_ig_enabled": true,
    "wa_to_ig_message_count": 3,
    "wa_to_ig_message": "Para te identificarmos em outros canais, qual é o seu @ do Instagram? (Opcional, responda não para pular)",
    "ig_to_wa_enabled": true,
    "ig_to_wa_message": "Para te atendermos melhor, qual é o seu WhatsApp? (Opcional, responda não para pular)",
    "email_collection_enabled": true
  }'::jsonb,
  '{"enabled": false}'::jsonb,
  '{"enabled": false}'::jsonb
)
ON CONFLICT (channel) DO NOTHING;
