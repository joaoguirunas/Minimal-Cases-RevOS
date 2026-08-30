-- Add meta_template_name column to whatsapp_templates
-- This stores the exact template name registered on Meta (not the Gupshup numeric ID)
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS meta_template_name TEXT;
