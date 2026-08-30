-- Adicionar stage_id para vincular agente a uma etapa específica do pipeline
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS leads_stages_id uuid REFERENCES leads_stages(id);

-- Adicionar array de score_matrix_ids para substituir a tabela de relacionamento
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS score_matrix_ids uuid[] DEFAULT '{}';

-- Remover colunas pipeline_id e stage_id dos steps (agora configurado no agente)
ALTER TABLE ai_agents_steps DROP COLUMN IF EXISTS pipeline_id;
ALTER TABLE ai_agents_steps DROP COLUMN IF EXISTS stage_id;