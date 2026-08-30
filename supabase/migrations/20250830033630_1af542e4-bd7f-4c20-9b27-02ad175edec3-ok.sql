-- Adicionar campo título na tabela crm_leads
ALTER TABLE crm_leads 
ADD COLUMN titulo TEXT;

-- Comentário para o campo título
COMMENT ON COLUMN crm_leads.titulo IS 'Título do negócio (opcional)';