
-- Adicionar o campo webhook_conversas à tabela crm_tenants (permitindo NULL para criação)
ALTER TABLE public.crm_tenants 
ADD COLUMN webhook_conversas TEXT;

-- Adicionar constraint para validar formato de URL quando o campo não é nulo
ALTER TABLE public.crm_tenants 
ADD CONSTRAINT webhook_conversas_url_format 
CHECK (webhook_conversas IS NULL OR webhook_conversas ~ '^https?://[^\s/$.?#].[^\s]*$');
