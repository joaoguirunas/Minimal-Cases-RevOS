
-- Habilitar realtime para a tabela crm_messages
ALTER TABLE public.crm_messages REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages;
