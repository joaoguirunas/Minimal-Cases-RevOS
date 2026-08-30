-- Habilitar realtime para tabelas do CRM que precisam de sincronização em tempo real

-- Habilitar realtime para crm_leads (tabela principal dos negócios)
ALTER TABLE public.crm_leads REPLICA IDENTITY FULL;

-- Adicionar crm_leads à publicação realtime se ainda não estiver
DO $$
BEGIN
    -- Verificar se a tabela já está na publicação
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'crm_leads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;
    END IF;
END $$;

-- Habilitar realtime para crm_pessoas (dados das pessoas podem ser atualizados)
ALTER TABLE public.crm_pessoas REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'crm_pessoas'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_pessoas;
    END IF;
END $$;

-- Habilitar realtime para crm_stages (mudanças nas etapas)
ALTER TABLE public.crm_stages REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'crm_stages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_stages;
    END IF;
END $$;

-- Habilitar realtime para crm_pipelines (mudanças nos pipelines)
ALTER TABLE public.crm_pipelines REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'crm_pipelines'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_pipelines;
    END IF;
END $$;