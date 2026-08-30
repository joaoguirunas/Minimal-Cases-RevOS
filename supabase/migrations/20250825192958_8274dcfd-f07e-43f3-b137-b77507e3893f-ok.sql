-- Adicionar colunas 'quantidade' e 'local' na tabela crm_agendamentos
ALTER TABLE crm_agendamentos 
ADD COLUMN quantidade INTEGER NULL,
ADD COLUMN local TEXT NULL;