-- Fix RLS policy for initial user profile creation
-- Drop existing policy
DROP POLICY IF EXISTS "usuarios_access_policy" ON public.crm_usuarios;

-- Create separate policies for different operations
-- Allow authenticated users to insert their own profile
CREATE POLICY "usuarios_insert_own_profile" ON public.crm_usuarios
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

-- Allow select/update/delete based on existing logic
CREATE POLICY "usuarios_access_existing" ON public.crm_usuarios
  FOR ALL
  TO authenticated
  USING (is_super_admin() OR (tenant_id = get_current_user_tenant_id()));

-- Create the missing get_user_available_tenants function
CREATE OR REPLACE FUNCTION public.get_user_available_tenants()
RETURNS TABLE (
  id uuid,
  name text,
  value text,
  ativo boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- If user is super admin, return all active tenants
  SELECT t.id, t.name, t.value, t.ativo
  FROM crm_tenants t
  WHERE t.ativo = true 
    AND (
      is_super_admin() 
      OR t.id = get_current_user_tenant_id()
    )
  ORDER BY t.name;
$$;