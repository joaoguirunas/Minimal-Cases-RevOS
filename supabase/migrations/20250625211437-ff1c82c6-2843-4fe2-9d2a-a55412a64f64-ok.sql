
-- Remove o campo telefone e adiciona o campo de preferência para ligação
ALTER TABLE crm_pessoas DROP COLUMN IF EXISTS telefone;
ALTER TABLE crm_pessoas ADD COLUMN IF NOT EXISTS aceita_ligacao boolean DEFAULT true;

-- Atualizar comentários para documentar as mudanças
COMMENT ON COLUMN crm_pessoas.whatsapp IS 'Número do WhatsApp da pessoa (unificado com telefone)';
COMMENT ON COLUMN crm_pessoas.aceita_ligacao IS 'Indica se a pessoa aceita receber ligações (padrão: sim)';
