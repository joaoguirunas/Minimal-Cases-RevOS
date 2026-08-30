-- Adicionar coluna stage_id para relacionar steps com stages específicas do pipeline
ALTER TABLE ai_agents_steps 
ADD COLUMN stage_id uuid REFERENCES leads_stages(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance nas consultas
CREATE INDEX idx_ai_agents_steps_stage_id ON ai_agents_steps(stage_id);

-- Comentário explicativo
COMMENT ON COLUMN ai_agents_steps.stage_id IS 'Relaciona o step com uma etapa específica do pipeline (leads_stages)';