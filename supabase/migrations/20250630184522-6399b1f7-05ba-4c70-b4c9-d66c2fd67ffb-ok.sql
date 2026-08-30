
-- Remover TODAS as políticas existentes que estão causando recursão
DROP POLICY IF EXISTS "allow_users_own_profile_select" ON public.crm_usuarios;
DROP POLICY IF EXISTS "allow_users_own_profile_update" ON public.crm_usuarios;
DROP POLICY IF EXISTS "allow_super_admin_all_select" ON public.crm_usuarios;
DROP POLICY IF EXISTS "allow_super_admin_all_operations" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Super admins can manage all users" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Users can view own data or tenant data" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Users can update own data or admins can update tenant data" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Super admins can insert users" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Super admins can delete users" ON public.crm_usuarios;

-- Criar políticas SIMPLES sem recursão
CREATE POLICY "authenticated_users_can_read_own_profile"
ON public.crm_usuarios
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

CREATE POLICY "authenticated_users_can_update_own_profile"
ON public.crm_usuarios
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid());

-- Política específica para super admins (sem usar funções que causam recursão)
CREATE POLICY "super_admins_can_read_all"
ON public.crm_usuarios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.super_adm = true 
    AND u.ativo = true
  )
);

CREATE POLICY "super_admins_can_manage_all"
ON public.crm_usuarios
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.super_adm = true 
    AND u.ativo = true
  )
);
