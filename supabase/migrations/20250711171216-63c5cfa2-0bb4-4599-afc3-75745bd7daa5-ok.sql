
-- Adicionar colunas de motivo de perda na tabela crm_leads
ALTER TABLE crm_leads 
ADD COLUMN motivo_perda TEXT NULL,
ADD COLUMN motivo_perda_id UUID NULL;

-- Adicionar foreign key para a tabela crm_motivo_perda
ALTER TABLE crm_leads 
ADD CONSTRAINT fk_leads_motivo_perda 
FOREIGN KEY (motivo_perda_id) REFERENCES crm_motivo_perda(id);
