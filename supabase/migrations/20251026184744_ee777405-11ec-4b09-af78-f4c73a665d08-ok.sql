-- Adicionar campo de dados de entrada na tabela de agentes
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS input_data TEXT;