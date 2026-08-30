-- Habilitar realtime para as tabelas principais
ALTER TABLE public.crm_messages REPLICA IDENTITY FULL;
ALTER TABLE public.crm_pessoas REPLICA IDENTITY FULL;
ALTER TABLE public.crm_leads REPLICA IDENTITY FULL;

-- Adicionar as tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_pessoas; 
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;