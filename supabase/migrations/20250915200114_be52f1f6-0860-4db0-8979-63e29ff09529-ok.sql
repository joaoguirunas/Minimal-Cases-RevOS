-- Configurar REPLICA IDENTITY FULL para realtime funcionar corretamente
-- Isso é necessário para que o realtime capture todas as mudanças

-- Configurar para crm_messages
ALTER TABLE public.crm_messages REPLICA IDENTITY FULL;

-- Configurar para crm_pessoas  
ALTER TABLE public.crm_pessoas REPLICA IDENTITY FULL;

-- Configurar para crm_leads
ALTER TABLE public.crm_leads REPLICA IDENTITY FULL;

-- Configurar para crm_agendamentos
ALTER TABLE public.crm_agendamentos REPLICA IDENTITY FULL;

-- Verificar se as tabelas já estão na publicação realtime, se não, adicionar
DO $$
BEGIN
    -- Verificar e adicionar crm_messages se necessário
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'crm_messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages;
    END IF;
    
    -- Verificar e adicionar crm_pessoas se necessário
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'crm_pessoas') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_pessoas;
    END IF;
    
    -- Verificar e adicionar crm_leads se necessário
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'crm_leads') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;
    END IF;
    
    -- Verificar e adicionar crm_agendamentos se necessário
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'crm_agendamentos') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_agendamentos;
    END IF;
END $$;