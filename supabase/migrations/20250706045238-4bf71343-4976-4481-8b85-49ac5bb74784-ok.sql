
-- Verificar se as tabelas campanhas e campanha_contatos existem e criar se necessário
-- Criar a tabela campanhas se não existir
CREATE TABLE IF NOT EXISTS public.campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.crm_tenants(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    canal TEXT NOT NULL CHECK (canal IN ('WhatsApp', 'E-mail')),
    mensagem TEXT NOT NULL,
    tempo_espera_envios TEXT NOT NULL DEFAULT '5_min' CHECK (tempo_espera_envios IN ('1_min', '5_min', '10_min', '30_min', '1_hora')),
    intervalo_inicio TIME NOT NULL DEFAULT '09:00:00',
    intervalo_fim TIME NOT NULL DEFAULT '18:00:00',
    pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
    etapa_id UUID REFERENCES public.crm_stages(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativa', 'pausada', 'concluída')),
    criada_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Criar a tabela campanha_contatos se não existir
CREATE TABLE IF NOT EXISTS public.campanha_contatos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.crm_tenants(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    status_envio TEXT NOT NULL DEFAULT 'pendente' CHECK (status_envio IN ('pendente', 'enviado', 'erro')),
    resposta TEXT,
    enviado_em TIMESTAMP WITH TIME ZONE,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanha_contatos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para campanhas
DROP POLICY IF EXISTS "Users can view campanhas from their tenant" ON public.campanhas;
CREATE POLICY "Users can view campanhas from their tenant" ON public.campanhas
    FOR SELECT USING (user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert campanhas in their tenant" ON public.campanhas
    FOR INSERT WITH CHECK (user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update campanhas from their tenant" ON public.campanhas
    FOR UPDATE USING (user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete campanhas from their tenant" ON public.campanhas
    FOR DELETE USING (user_has_tenant_access(tenant_id));

-- Políticas RLS para campanha_contatos
DROP POLICY IF EXISTS "Users can view campanha_contatos from their tenant" ON public.campanha_contatos;
CREATE POLICY "Users can view campanha_contatos from their tenant" ON public.campanha_contatos
    FOR SELECT USING (user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert campanha_contatos in their tenant" ON public.campanha_contatos
    FOR INSERT WITH CHECK (user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update campanha_contatos from their tenant" ON public.campanha_contatos
    FOR UPDATE USING (user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete campanha_contatos from their tenant" ON public.campanha_contatos
    FOR DELETE USING (user_has_tenant_access(tenant_id));

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger nas tabelas
DROP TRIGGER IF EXISTS update_campanhas_updated_at ON public.campanhas;
CREATE TRIGGER update_campanhas_updated_at
    BEFORE UPDATE ON public.campanhas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campanha_contatos_updated_at ON public.campanha_contatos;
CREATE TRIGGER update_campanha_contatos_updated_at
    BEFORE UPDATE ON public.campanha_contatos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
