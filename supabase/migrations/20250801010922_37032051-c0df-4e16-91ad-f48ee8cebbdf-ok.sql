-- Criar índices otimizados para conversas paginadas
-- Índice composto para buscar última mensagem por pessoa mais eficientemente
CREATE INDEX IF NOT EXISTS idx_crm_messages_pessoa_created_at 
ON crm_messages (tenant_id, pessoa_id, created_at DESC);

-- Índice para contagem rápida de mensagens por pessoa
CREATE INDEX IF NOT EXISTS idx_crm_messages_pessoa_count
ON crm_messages (tenant_id, pessoa_id);

-- Índice para pessoas ordenadas por data de criação
CREATE INDEX IF NOT EXISTS idx_crm_pessoas_tenant_created_at
ON crm_pessoas (tenant_id, status, created_at DESC);

-- Índice para leads com responsável
CREATE INDEX IF NOT EXISTS idx_crm_leads_responsavel_tenant
ON crm_leads (tenant_id, responsavel, person_id);

-- Índice para leads com pipeline
CREATE INDEX IF NOT EXISTS idx_crm_leads_pipeline_tenant  
ON crm_leads (tenant_id, pipeline_id, person_id);

-- Índice para leads com stage
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage_tenant
ON crm_leads (tenant_id, stage_id, person_id);