-- Adicionar campo variables na tabela whatsapp_templates
ALTER TABLE public.whatsapp_templates 
ADD COLUMN variables JSONB NULL;