
-- Adicionar os novos campos na tabela crm_pessoas
ALTER TABLE crm_pessoas 
ADD COLUMN score integer,
ADD COLUMN renda text,
ADD COLUMN momento text,
ADD COLUMN objetivo text;
