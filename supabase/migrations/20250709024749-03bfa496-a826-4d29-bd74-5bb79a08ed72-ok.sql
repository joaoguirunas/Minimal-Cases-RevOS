
-- Adicionar colunas específicas para configurações DISC na tabela crm_tenants
ALTER TABLE crm_tenants 
ADD COLUMN openai_api_key TEXT,
ADD COLUMN openai_model TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN openai_temperature DECIMAL(3,2) DEFAULT 0.7,
ADD COLUMN openai_enabled BOOLEAN DEFAULT false;

-- Adicionar comentários para documentar as colunas
COMMENT ON COLUMN crm_tenants.openai_api_key IS 'Chave da API OpenAI para análise DISC';
COMMENT ON COLUMN crm_tenants.openai_model IS 'Modelo OpenAI utilizado (gpt-4o-mini, gpt-4o, etc.)';
COMMENT ON COLUMN crm_tenants.openai_temperature IS 'Temperatura para análise DISC (0.0 a 2.0)';
COMMENT ON COLUMN crm_tenants.openai_enabled IS 'Se a análise DISC automática está habilitada';
