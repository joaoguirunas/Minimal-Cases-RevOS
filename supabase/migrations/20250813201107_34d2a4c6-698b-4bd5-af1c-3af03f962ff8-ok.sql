-- CORREÇÃO CRÍTICA: Resolver recursão infinita nas políticas RLS de crm_usuarios
-- O problema está nas políticas que fazem self-reference à própria tabela

-- Primeiro, vamos remover TODAS as políticas problemáticas
DROP POLICY IF EXISTS "secure_tenant_based_access" ON public.crm_usuarios;
DROP POLICY IF EXISTS "secure_user_creation" ON public.crm_usuarios;
DROP POLICY IF EXISTS "secure_user_updates" ON public.crm_usuarios;
DROP POLICY IF EXISTS "secure_user_deletion" ON public.crm_usuarios;

-- Criar funções security definer para evitar recursão
CREATE OR REPLACE FUNCTION public.is_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(super_adm, false) FROM public.crm_usuarios WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_user_manager_for_tenant(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND tenant_id = target_tenant_id 
    AND gestor = true 
    AND ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.crm_usuarios WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1;
$$;

-- Criar políticas simples e seguras sem recursão
CREATE POLICY "users_can_read_profiles" ON public.crm_usuarios
FOR SELECT
TO authenticated
USING (
  -- User can see their own profile
  auth_user_id = auth.uid()
  OR
  -- Super admins can see all profiles
  public.is_user_super_admin()
  OR
  -- Managers can see users from their tenant
  public.is_user_manager_for_tenant(tenant_id)
);

CREATE POLICY "users_can_create_profiles" ON public.crm_usuarios
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Allow self-registration
  auth_user_id = auth.uid()
  OR
  -- Super admins can create any user
  public.is_user_super_admin()
  OR
  -- Managers can create users in their tenant
  public.is_user_manager_for_tenant(tenant_id)
);

CREATE POLICY "users_can_update_profiles" ON public.crm_usuarios
FOR UPDATE
TO authenticated
USING (
  -- User can update their own profile
  auth_user_id = auth.uid()
  OR
  -- Super admins can update any user
  public.is_user_super_admin()
  OR
  -- Managers can update users in their tenant
  public.is_user_manager_for_tenant(tenant_id)
)
WITH CHECK (
  -- Same conditions for updates
  auth_user_id = auth.uid()
  OR
  public.is_user_super_admin()
  OR
  public.is_user_manager_for_tenant(tenant_id)
);

CREATE POLICY "users_can_delete_profiles" ON public.crm_usuarios
FOR DELETE
TO authenticated
USING (
  -- Super admins can delete any user
  public.is_user_super_admin()
  OR
  -- Managers can delete users in their tenant (except other managers/super admins)
  (
    public.is_user_manager_for_tenant(tenant_id)
    AND gestor = false
    AND super_adm = false
  )
);

-- Verificar as políticas criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'crm_usuarios'
ORDER BY policyname;