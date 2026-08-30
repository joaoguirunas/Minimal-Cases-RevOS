-- Alterar score_matrix para usar arrays em vez de UUIDs únicos
-- Primeiro, criar colunas temporárias com arrays
ALTER TABLE score_matrix 
  ADD COLUMN objective_ids UUID[],
  ADD COLUMN investment_ids UUID[],
  ADD COLUMN framing_ids UUID[];

-- Migrar dados existentes para os arrays (converter UUID único em array com 1 elemento)
UPDATE score_matrix 
SET 
  objective_ids = ARRAY[objective_id],
  investment_ids = ARRAY[investment_id],
  framing_ids = ARRAY[framing_id]
WHERE objective_id IS NOT NULL 
  AND investment_id IS NOT NULL 
  AND framing_id IS NOT NULL;

-- Remover colunas antigas
ALTER TABLE score_matrix 
  DROP COLUMN objective_id,
  DROP COLUMN investment_id,
  DROP COLUMN framing_id;

-- Renomear novas colunas para os nomes originais
ALTER TABLE score_matrix 
  RENAME COLUMN objective_ids TO objective_id;
ALTER TABLE score_matrix 
  RENAME COLUMN investment_ids TO investment_id;
ALTER TABLE score_matrix 
  RENAME COLUMN framing_ids TO framing_id;

-- Adicionar constraints para garantir que arrays não sejam vazios
ALTER TABLE score_matrix
  ADD CONSTRAINT objective_id_not_empty CHECK (array_length(objective_id, 1) > 0),
  ADD CONSTRAINT investment_id_not_empty CHECK (array_length(investment_id, 1) > 0),
  ADD CONSTRAINT framing_id_not_empty CHECK (array_length(framing_id, 1) > 0);

-- Criar índices GIN para melhor performance em queries com arrays
CREATE INDEX idx_score_matrix_objective_ids ON score_matrix USING GIN (objective_id);
CREATE INDEX idx_score_matrix_investment_ids ON score_matrix USING GIN (investment_id);
CREATE INDEX idx_score_matrix_framing_ids ON score_matrix USING GIN (framing_id);