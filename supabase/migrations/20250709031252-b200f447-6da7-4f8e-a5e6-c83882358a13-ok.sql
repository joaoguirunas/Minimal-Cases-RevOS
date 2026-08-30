
-- Remover as colunas individuais da OpenAI e criar campos JSON para cada funcionalidade
ALTER TABLE crm_tenants 
DROP COLUMN IF EXISTS openai_api_key,
DROP COLUMN IF EXISTS openai_model,
DROP COLUMN IF EXISTS openai_temperature,
DROP COLUMN IF EXISTS openai_enabled;

-- Adicionar campos JSON para configurações DISC e Resumo
ALTER TABLE crm_tenants 
ADD COLUMN disc_config JSONB DEFAULT '{"enabled": false, "api_key": null, "model": "gpt-4o-mini", "temperature": 0.7}'::jsonb,
ADD COLUMN resumo_config JSONB DEFAULT '{"enabled": false, "api_key": null, "model": "gpt-4o-mini", "temperature": 0.7}'::jsonb;

-- Adicionar coluna para armazenar resumos das conversas nas pessoas
ALTER TABLE crm_pessoas 
ADD COLUMN resumo_conversa TEXT;

-- Adicionar coluna para controlar contagem de mensagens para resumo
ALTER TABLE crm_pessoas 
ADD COLUMN contador_mensagens_resumo INTEGER DEFAULT 0;

-- Comentários para documentar as novas colunas
COMMENT ON COLUMN crm_tenants.disc_config IS 'Configuração OpenAI para análise DISC (JSON com enabled, api_key, model, temperature)';
COMMENT ON COLUMN crm_tenants.resumo_config IS 'Configuração OpenAI para resumo de conversas (JSON com enabled, api_key, model, temperature)';
COMMENT ON COLUMN crm_pessoas.resumo_conversa IS 'Resumo acumulativo das conversas da pessoa';
COMMENT ON COLUMN crm_pessoas.contador_mensagens_resumo IS 'Contador de mensagens para controle do resumo automático';
