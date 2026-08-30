-- Rollback: 20260424011000_settings_bi_voice_beta_flag
ALTER TABLE public.settings
  DROP COLUMN IF EXISTS bi_voice_chat_beta_enabled;
