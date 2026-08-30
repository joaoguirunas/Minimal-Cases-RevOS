
-- Adicionar o campo descricao_disc na tabela crm_pessoas
ALTER TABLE crm_pessoas 
ADD COLUMN descricao_disc text;

-- Adicionar comentário para documentar o campo
COMMENT ON COLUMN crm_pessoas.descricao_disc IS 'Descrição detalhada da análise DISC feita pela IA';
