
-- Limpar políticas que podem ter sido criadas parcialmente
DROP POLICY IF EXISTS "Users can view times of their tenant" ON public.crm_times;
DROP POLICY IF EXISTS "Users can create times in their tenant" ON public.crm_times;
DROP POLICY IF EXISTS "Users can update times of their tenant" ON public.crm_times;
DROP POLICY IF EXISTS "Users can delete times of their tenant" ON public.crm_times;
DROP POLICY IF EXISTS "Users can view user_times of their tenant" ON public.crm_usuario_times;
DROP POLICY IF EXISTS "Users can create user_times in their tenant" ON public.crm_usuario_times;
DROP POLICY IF EXISTS "Users can delete user_times of their tenant" ON public.crm_usuario_times;

-- Criar função para verificar se usuário tem acesso ao tenant
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = target_tenant_id OR super_adm = true)
  );
$$;

-- Habilitar RLS na tabela crm_times
ALTER TABLE public.crm_times ENABLE ROW LEVEL SECURITY;

-- Políticas para crm_times usando a função
CREATE POLICY "Users can view times of their tenant" 
ON public.crm_times 
FOR SELECT 
USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can create times in their tenant" 
ON public.crm_times 
FOR INSERT 
WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update times of their tenant" 
ON public.crm_times 
FOR UPDATE 
USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete times of their tenant" 
ON public.crm_times 
FOR DELETE 
USING (public.user_has_tenant_access(tenant_id));

-- Habilitar RLS na tabela crm_usuario_times
ALTER TABLE public.crm_usuario_times ENABLE ROW LEVEL SECURITY;

-- Políticas para crm_usuario_times
CREATE POLICY "Users can view user_times of their tenant" 
ON public.crm_usuario_times 
FOR SELECT 
USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can create user_times in their tenant" 
ON public.crm_usuario_times 
FOR INSERT 
WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete user_times of their tenant" 
ON public.crm_usuario_times 
FOR DELETE 
USING (public.user_has_tenant_access(tenant_id));
