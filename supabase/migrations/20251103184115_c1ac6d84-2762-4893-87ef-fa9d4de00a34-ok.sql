-- Adicionar campo system_enabled na tabela whatsapp_templates
ALTER TABLE whatsapp_templates 
ADD COLUMN system_enabled boolean NOT NULL DEFAULT false;