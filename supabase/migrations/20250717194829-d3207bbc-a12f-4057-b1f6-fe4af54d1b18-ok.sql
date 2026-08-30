
-- Adicionar índices otimizados para consultas do dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_messages_tenant_created_at 
ON crm_messages (tenant_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_messages_tenant_created_from 
ON crm_messages (tenant_id, created_at, from_message);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_messages_tenant_created_tipo 
ON crm_messages (tenant_id, created_at, tipo_mensagem);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_messages_tenant_followup 
ON crm_messages (tenant_id, followup_id) WHERE followup_id IS NOT NULL;

-- Índice para otimizar consultas por pessoa
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_messages_tenant_pessoa 
ON crm_messages (tenant_id, pessoa_id, created_at);

-- Índice para otimizar consultas por responsável (via join com crm_pessoas -> crm_leads)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_leads_tenant_responsavel 
ON crm_leads (tenant_id, responsavel);
