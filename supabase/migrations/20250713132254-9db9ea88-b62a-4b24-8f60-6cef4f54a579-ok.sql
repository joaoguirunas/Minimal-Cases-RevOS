
-- Adicionar colunas pessoa_id e negocio_id à tabela de reservas
ALTER TABLE crm_reservas_reservas 
ADD COLUMN pessoa_id uuid,
ADD COLUMN negocio_id uuid;

-- Adicionar foreign keys
ALTER TABLE crm_reservas_reservas 
ADD CONSTRAINT fk_reservas_pessoa 
FOREIGN KEY (pessoa_id) REFERENCES crm_pessoas(id) ON DELETE CASCADE;

ALTER TABLE crm_reservas_reservas 
ADD CONSTRAINT fk_reservas_negocio 
FOREIGN KEY (negocio_id) REFERENCES crm_leads(id) ON DELETE CASCADE;

-- Remover as colunas antigas de cliente_nome e cliente_contato (após migração dos dados)
-- ALTER TABLE crm_reservas_reservas DROP COLUMN cliente_nome;
-- ALTER TABLE crm_reservas_reservas DROP COLUMN cliente_contato;
