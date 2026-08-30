
-- Tabela crm_empresas (Empresas – Pessoa Jurídica)
CREATE TABLE public.crm_empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT,
  cnpj TEXT,
  telefone TEXT,
  email TEXT,
  site TEXT,
  observacoes TEXT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela crm_pessoas (Clientes – Pessoa Física)
CREATE TABLE public.crm_pessoas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  documento TEXT,
  empresa_id UUID REFERENCES public.crm_empresas(id) ON DELETE SET NULL,
  origem TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'ativo',
  observacoes TEXT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela crm_leads (Negócios)
CREATE TABLE public.crm_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES public.crm_pessoas(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.crm_empresas(id) ON DELETE SET NULL,
  pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.crm_stages(id) ON DELETE RESTRICT,
  valor NUMERIC(15,2),
  status TEXT DEFAULT 'em-andamento',
  responsavel UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_ultima_interacao TIMESTAMP WITH TIME ZONE,
  ultima_interacao TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  gclid TEXT,
  fbclid TEXT,
  status_followup TEXT,
  tentativas_followup INTEGER DEFAULT 0,
  bloqueia_ia BOOLEAN DEFAULT false,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Regra de unicidade: uma pessoa pode ter apenas 1 lead por pipeline
  UNIQUE(person_id, pipeline_id)
);

-- Tabela messages (Conversas)
CREATE TABLE public.messages (
  id SERIAL PRIMARY KEY,
  from_message TEXT NOT NULL,
  message TEXT NOT NULL,
  thread_id TEXT,
  llm TEXT,
  tokens_qty INTEGER,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para otimização de consultas
CREATE INDEX idx_crm_empresas_tenant_id ON public.crm_empresas(tenant_id);
CREATE INDEX idx_crm_pessoas_tenant_id ON public.crm_pessoas(tenant_id);
CREATE INDEX idx_crm_pessoas_empresa_id ON public.crm_pessoas(empresa_id);
CREATE INDEX idx_crm_leads_tenant_id ON public.crm_leads(tenant_id);
CREATE INDEX idx_crm_leads_person_id ON public.crm_leads(person_id);
CREATE INDEX idx_crm_leads_pipeline_id ON public.crm_leads(pipeline_id);
CREATE INDEX idx_messages_tenant_id ON public.messages(tenant_id);
CREATE INDEX idx_messages_lead_id ON public.messages(lead_id);

-- Triggers para atualização automática do updated_at
CREATE TRIGGER trigger_crm_empresas_updated_at
  BEFORE UPDATE ON public.crm_empresas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_crm_pessoas_updated_at
  BEFORE UPDATE ON public.crm_pessoas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS (Row Level Security) para isolamento por tenant
ALTER TABLE public.crm_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para crm_empresas
CREATE POLICY "crm_empresas_tenant_isolation" ON public.crm_empresas
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Políticas RLS para crm_pessoas
CREATE POLICY "crm_pessoas_tenant_isolation" ON public.crm_pessoas
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Políticas RLS para crm_leads
CREATE POLICY "crm_leads_tenant_isolation" ON public.crm_leads
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Políticas RLS para messages
CREATE POLICY "messages_tenant_isolation" ON public.messages
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
