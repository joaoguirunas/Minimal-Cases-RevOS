-- Adicionar coluna score_matrix_ids na tabela ai_agents
ALTER TABLE ai_agents 
ADD COLUMN score_matrix_ids uuid[] DEFAULT '{}';

-- Migrar dados existentes da tabela ai_agents_score_matrix para a nova coluna
UPDATE ai_agents 
SET score_matrix_ids = (
  SELECT ARRAY_AGG(score_matrix_id)
  FROM ai_agents_score_matrix
  WHERE ai_agent_id = ai_agents.id 
    AND active = true
);

-- Garantir que agentes sem associação tenham array vazio ao invés de NULL
UPDATE ai_agents 
SET score_matrix_ids = '{}' 
WHERE score_matrix_ids IS NULL;

-- Alterar coluna para NOT NULL agora que todos têm valor
ALTER TABLE ai_agents 
ALTER COLUMN score_matrix_ids SET NOT NULL;

-- Remover tabela ai_agents_score_matrix (não é mais necessária)
DROP TABLE IF EXISTS ai_agents_score_matrix CASCADE;