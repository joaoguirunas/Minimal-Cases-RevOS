-- Configurar tabelas para realtime corretamente
-- Habilitar REPLICA IDENTITY FULL para todas as tabelas CRM

ALTER TABLE public.crm_messages REPLICA IDENTITY FULL;
ALTER TABLE public.crm_pessoas REPLICA IDENTITY FULL;
ALTER TABLE public.crm_leads REPLICA IDENTITY FULL;
ALTER TABLE public.crm_agendamentos REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação do realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_pessoas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_agendamentos;