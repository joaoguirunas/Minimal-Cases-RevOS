-- Adicionar campo data_ganho na tabela crm_leads
ALTER TABLE crm_leads 
ADD COLUMN IF NOT EXISTS data_ganho TIMESTAMP WITH TIME ZONE;

-- Comentário para o campo data_ganho
COMMENT ON COLUMN crm_leads.data_ganho IS 'Data em que o negócio foi ganho';