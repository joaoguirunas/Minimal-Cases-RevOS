
-- Adicionar coluna canal na tabela crm_messages
ALTER TABLE public.crm_messages 
ADD COLUMN canal TEXT DEFAULT 'whatsapp';

-- Adicionar comentário para documentar os valores possíveis
COMMENT ON COLUMN public.crm_messages.canal IS 'Canal da mensagem: whatsapp, instagram, email, telefone';
