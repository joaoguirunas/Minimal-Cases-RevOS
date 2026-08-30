
-- Criar tabela de associação entre pessoas e empresas (many-to-many)
CREATE TABLE public.crm_pessoa_empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id UUID NOT NULL REFERENCES crm_pessoas(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES crm_empresas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES crm_tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Garantir que uma pessoa não pode ser associada à mesma empresa mais de uma vez
  UNIQUE(pessoa_id, empresa_id)
);

-- Habilitar Row Level Security
ALTER TABLE public.crm_pessoa_empresas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para isolamento por tenant
CREATE POLICY "Users can view pessoa_empresas from their tenant" 
  ON public.crm_pessoa_empresas 
  FOR SELECT 
  USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert pessoa_empresas in their tenant" 
  ON public.crm_pessoa_empresas 
  FOR INSERT 
  WITH CHECK (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update pessoa_empresas from their tenant" 
  ON public.crm_pessoa_empresas 
  FOR UPDATE 
  USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete pessoa_empresas from their tenant" 
  ON public.crm_pessoa_empresas 
  FOR DELETE 
  USING (user_has_tenant_access(tenant_id));

-- Criar índices para melhor performance
CREATE INDEX idx_crm_pessoa_empresas_pessoa_id ON public.crm_pessoa_empresas(pessoa_id);
CREATE INDEX idx_crm_pessoa_empresas_empresa_id ON public.crm_pessoa_empresas(empresa_id);
CREATE INDEX idx_crm_pessoa_empresas_tenant_id ON public.crm_pessoa_empresas(tenant_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER trigger_crm_pessoa_empresas_updated_at
  BEFORE UPDATE ON public.crm_pessoa_empresas
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
