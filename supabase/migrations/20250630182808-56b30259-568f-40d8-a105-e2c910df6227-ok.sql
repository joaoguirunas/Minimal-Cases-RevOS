
-- Remove ALL existing policies from crm_usuarios to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Super admins can manage all users" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Users can view users in their tenant" ON public.crm_usuarios;

-- Recreate the security definer functions (they should already exist but let's make sure)
CREATE OR REPLACE FUNCTION public.get_current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT tenant_id FROM public.crm_usuarios WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER  
AS $$
  SELECT COALESCE(super_adm, false) FROM public.crm_usuarios WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Create simple, non-recursive policies with unique names
CREATE POLICY "allow_users_own_profile_select"
ON public.crm_usuarios
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "allow_users_own_profile_update"
ON public.crm_usuarios
FOR UPDATE
USING (auth_user_id = auth.uid());

CREATE POLICY "allow_super_admin_all_select"
ON public.crm_usuarios
FOR SELECT
USING (public.is_current_user_super_admin() = true);

CREATE POLICY "allow_super_admin_all_operations"
ON public.crm_usuarios
FOR ALL
USING (public.is_current_user_super_admin() = true);
