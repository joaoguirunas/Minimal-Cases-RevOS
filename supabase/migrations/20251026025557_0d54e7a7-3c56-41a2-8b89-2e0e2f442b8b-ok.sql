-- Remove campos antigos de score da tabela clients_people
ALTER TABLE clients_people 
  DROP COLUMN IF EXISTS moment,
  DROP COLUMN IF EXISTS goal,
  DROP COLUMN IF EXISTS income,
  DROP COLUMN IF EXISTS disc_profile,
  DROP COLUMN IF EXISTS disc_summary,
  DROP COLUMN IF EXISTS score;

-- Adicionar comentário explicativo
COMMENT ON COLUMN clients_people.score_matrix_id IS 'Referência para a matriz de score completa';