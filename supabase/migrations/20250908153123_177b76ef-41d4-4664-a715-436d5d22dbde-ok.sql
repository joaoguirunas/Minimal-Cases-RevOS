-- Criar tabela de agências
CREATE TABLE public.crm_agencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Criar tabela de relacionamento entre agências e tenants
CREATE TABLE public.crm_agencia_tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agencia_id UUID NOT NULL REFERENCES public.crm_agencias(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.crm_tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agencia_id, tenant_id)
);

-- Adicionar coluna agencia_id na tabela de usuários globais (crm_usuarios)
ALTER TABLE public.crm_usuarios 
ADD COLUMN agencia_id UUID REFERENCES public.crm_agencias(id) ON DELETE SET NULL;

-- Criar índices para melhor performance
CREATE INDEX idx_crm_agencias_ativo ON public.crm_agencias(ativo);
CREATE INDEX idx_crm_agencia_tenants_agencia_id ON public.crm_agencia_tenants(agencia_id);
CREATE INDEX idx_crm_agencia_tenants_tenant_id ON public.crm_agencia_tenants(tenant_id);
CREATE INDEX idx_crm_usuarios_agencia_id ON public.crm_usuarios(agencia_id);

-- Habilitar RLS para as novas tabelas
ALTER TABLE public.crm_agencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_agencia_tenants ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para crm_agencias (apenas super_adm pode gerenciar)
CREATE POLICY "Super admins can manage agencies" 
ON public.crm_agencias 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  ) 
  OR EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  ) 
  OR EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  )
);

-- Políticas RLS para crm_agencia_tenants (apenas super_adm pode gerenciar)
CREATE POLICY "Super admins can manage agency tenant relations" 
ON public.crm_agencia_tenants 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  ) 
  OR EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  ) 
  OR EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  )
);

-- Trigger para atualizar updated_at em crm_agencias
CREATE TRIGGER update_crm_agencias_updated_at
BEFORE UPDATE ON public.crm_agencias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();