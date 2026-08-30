
-- Primeiro, vamos criar uma função de segurança para evitar recursão
CREATE OR REPLACE FUNCTION public.get_current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id FROM public.crm_usuarios WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Criar função para verificar se é super admin
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(super_adm, false) FROM public.crm_usuarios WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Remover todas as políticas existentes da tabela crm_usuarios
DROP POLICY IF EXISTS "Users can view their own profile" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Super admins can manage all users" ON public.crm_usuarios;

-- Criar novas políticas sem recursão
CREATE POLICY "Users can view their own profile"
ON public.crm_usuarios
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

CREATE POLICY "Super admins can view all profiles"
ON public.crm_usuarios
FOR SELECT
TO authenticated
USING (public.is_current_user_super_admin());

CREATE POLICY "Users can update their own profile"
ON public.crm_usuarios
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid());

CREATE POLICY "Super admins can manage all users"
ON public.crm_usuarios
FOR ALL
TO authenticated
USING (public.is_current_user_super_admin());

-- Habilitar RLS na tabela
ALTER TABLE public.crm_usuarios ENABLE ROW LEVEL SECURITY;
