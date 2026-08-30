
-- Adicionar o campo perfil (DISC) na tabela crm_pessoas
ALTER TABLE crm_pessoas 
ADD COLUMN perfil text;

-- Adicionar comentário para documentar o campo
COMMENT ON COLUMN crm_pessoas.perfil IS 'Perfil DISC da pessoa (Dominância, Influência, Estabilidade, Conformidade)';
