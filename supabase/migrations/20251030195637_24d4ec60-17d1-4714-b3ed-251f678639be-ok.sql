-- Remove stage_id da tabela ai_agents_steps
ALTER TABLE ai_agents_steps DROP COLUMN IF EXISTS stage_id;

-- Remove stage_id da tabela de histórico
ALTER TABLE ai_agents_steps_history DROP COLUMN IF EXISTS stage_id;