-- BI-VOICE-04: feature flag de voice chat por tenant
-- Gestor habilita opt-in consciente (custo Gemini Live é por minuto billed).
-- DEFAULT false — nenhum tenant exposto automaticamente ao beta.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS bi_voice_chat_beta_enabled boolean NOT NULL DEFAULT false;
