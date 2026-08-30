-- Adicionar coluna control na tabela leads_stages_followups
ALTER TABLE leads_stages_followups
ADD COLUMN control integer;

-- Adicionar constraint para garantir que não seja negativo
ALTER TABLE leads_stages_followups
ADD CONSTRAINT control_non_negative CHECK (control >= 0);

-- Adicionar comentário descritivo
COMMENT ON COLUMN leads_stages_followups.control IS 'Campo de controle numérico para follow-ups (opcional, não pode ser negativo)';