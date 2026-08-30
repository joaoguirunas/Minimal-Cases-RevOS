-- Adicionar campos JSON para armazenar informações personalizadas
-- em todas as tabelas principais do sistema

-- 1. Adicionar campo pessoas_info_json na tabela crm_pessoas
ALTER TABLE public.crm_pessoas 
ADD COLUMN pessoas_info_json JSONB NULL;

-- 2. Adicionar campo empresas_info_json na tabela crm_empresas  
ALTER TABLE public.crm_empresas 
ADD COLUMN empresas_info_json JSONB NULL;

-- 3. Adicionar campo leads_info_json na tabela crm_leads
ALTER TABLE public.crm_leads 
ADD COLUMN leads_info_json JSONB NULL;

-- 4. Adicionar campo conversas_info_json na tabela crm_messages
ALTER TABLE public.crm_messages 
ADD COLUMN conversas_info_json JSONB NULL;

-- Comentários sobre os campos adicionados:
-- - Todos os campos são do tipo JSONB para melhor performance
-- - Todos são nullable (NULL) para manter compatibilidade com dados existentes
-- - Permitirão armazenar informações personalizadas em formato JSON
-- - JSONB suporta indexação e consultas eficientes se necessário no futuro