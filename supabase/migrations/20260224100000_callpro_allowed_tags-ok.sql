-- ═══════════════════════════════════════════════════════════════════════════════════
-- CALL PRO™ — Allowed Tags
-- P2.3: Adicionar allowed_tags em call_pro_settings para tags sugeridas gerenciadas
-- ═══════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.call_pro_settings
  ADD COLUMN IF NOT EXISTS allowed_tags text[] NOT NULL DEFAULT '{}';
