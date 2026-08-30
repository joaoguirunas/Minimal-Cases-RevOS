-- Adicionar pipeline_id ao agente (nível de agente, não apenas etapa)
ALTER TABLE ai_agents 
ADD COLUMN pipeline_id uuid REFERENCES leads_pipelines(id) ON DELETE SET NULL;

-- Adicionar campo decimal para matching de score
ALTER TABLE ai_agents 
ADD COLUMN score_value numeric(10,2);

-- Adicionar comentários
COMMENT ON COLUMN ai_agents.pipeline_id IS 'Pipeline associado a este agente (usado para filtrar etapas)';
COMMENT ON COLUMN ai_agents.score_value IS 'Valor de score para matching via n8n (não é FK, apenas referência numérica)';

-- Índices para melhorar performance
CREATE INDEX idx_ai_agents_pipeline_id ON ai_agents(pipeline_id);
CREATE INDEX idx_ai_agents_score_value ON ai_agents(score_value);