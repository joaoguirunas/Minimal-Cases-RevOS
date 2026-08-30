-- Criar tabela para conexões de databases dedicados
CREATE TABLE public.crm_database_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  nome_conexao TEXT NOT NULL,
  supabase_url TEXT NOT NULL,
  supabase_anon_key TEXT NOT NULL,
  status_conexao TEXT NOT NULL DEFAULT 'não_testado' CHECK (status_conexao IN ('ativo', 'conectado', 'erro', 'não_testado')),
  ultimo_teste TIMESTAMP WITH TIME ZONE,
  mensagem_erro TEXT,
  metadados JSONB DEFAULT '{}',
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.crm_database_connections ENABLE ROW LEVEL SECURITY;

-- Política restritiva apenas para super_admin
CREATE POLICY "Only super admins can manage database connections" 
ON public.crm_database_connections 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_crm_database_connections_updated_at
  BEFORE UPDATE ON public.crm_database_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Constraint para URL Supabase válida
ALTER TABLE public.crm_database_connections 
ADD CONSTRAINT valid_supabase_url 
CHECK (supabase_url ~ '^https://[a-z0-9]+\.supabase\.co$');

-- Index para performance
CREATE INDEX idx_crm_database_connections_tenant_id ON public.crm_database_connections(tenant_id);
CREATE INDEX idx_crm_database_connections_status ON public.crm_database_connections(status_conexao);