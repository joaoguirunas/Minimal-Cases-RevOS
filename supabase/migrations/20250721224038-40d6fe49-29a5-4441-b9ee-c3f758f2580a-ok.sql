
-- Habilitar REPLICA IDENTITY FULL para capturar dados completos das mudanças
ALTER TABLE public.crm_agendamentos REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação realtime para ativar funcionalidade em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_agendamentos;
