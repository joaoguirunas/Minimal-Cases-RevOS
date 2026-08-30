-- 1. Drop existing policy that depends on is_super_admin()
DROP POLICY IF EXISTS "usuarios_access_policy" ON public.settings_users;

-- 2. Drop and recreate is_super_admin() to point to settings_users
DROP FUNCTION IF EXISTS public.is_super_admin();

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(su.super_adm, false)
  FROM public.settings_users su
  WHERE su.auth_user_id = auth.uid();
$$;

-- 3. Recreate the access policy using the updated function
CREATE POLICY "usuarios_access_policy"
ON public.settings_users
FOR ALL
TO authenticated
USING ((auth.uid() = auth_user_id) OR is_super_admin());

-- 4. Add INSERT policy allowing super admins to create users for others
CREATE POLICY "usuarios_insert_super_admin"
ON public.settings_users
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());