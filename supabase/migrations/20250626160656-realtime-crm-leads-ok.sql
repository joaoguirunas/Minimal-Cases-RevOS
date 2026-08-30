
-- Habilitar realtime para a tabela crm_leads
ALTER TABLE public.crm_leads REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação realtime se ainda não estiver
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
