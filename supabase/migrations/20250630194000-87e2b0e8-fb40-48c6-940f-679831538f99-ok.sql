
-- Atualizar a tabela crm_leads para incluir time_responsavel se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_leads' AND column_name = 'time_responsavel') THEN
        ALTER TABLE public.crm_leads ADD COLUMN time_responsavel uuid;
    END IF;
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_crm_usuario_times_time_id ON public.crm_usuario_times(time_id);
CREATE INDEX IF NOT EXISTS idx_crm_usuario_times_usuario_id ON public.crm_usuario_times(usuario_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_time_responsavel ON public.crm_leads(time_responsavel);
CREATE INDEX IF NOT EXISTS idx_crm_leads_responsavel ON public.crm_leads(responsavel);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.crm_leads.time_responsavel IS 'Time responsável pelo atendimento do lead';
COMMENT ON COLUMN public.crm_leads.responsavel IS 'Usuário responsável específico pelo lead (deve estar no time)';
