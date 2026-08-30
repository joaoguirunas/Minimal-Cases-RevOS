-- Add meta_system_token + meta_system_token_saved_at to bi_settings
-- System User Token is permanent (no expiry), replaces User Access Token flow
-- See docs/smart-memory/project/audits/meta-simplification-proposal.md §6

ALTER TABLE public.bi_settings
  ADD COLUMN IF NOT EXISTS meta_system_token TEXT NULL,
  ADD COLUMN IF NOT EXISTS meta_system_token_saved_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.bi_settings.meta_system_token IS
  'Meta System User Token (permanente, gerado no Business Manager). Não expira.';
COMMENT ON COLUMN public.bi_settings.meta_system_token_saved_at IS
  'Timestamp de quando o operador salvou o System User Token. Referência para auditoria.';
