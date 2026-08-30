-- ═══════════════════════════════════════════════════════════════════
-- 20260508020000_lead_types_add_whatsapp_template.sql
-- Adiciona coluna whatsapp_template_id em lead_types (FK nullable).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.lead_types
  ADD COLUMN IF NOT EXISTS whatsapp_template_id uuid
    REFERENCES public.whatsapp_templates(id)
    ON DELETE SET NULL;
