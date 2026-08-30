-- Fix existing user data by updating auth_user_id
-- First, let's update the existing user with the correct auth_user_id
UPDATE crm_usuarios 
SET auth_user_id = '0e19572f-aa33-4132-b898-db638a675467'
WHERE email = 'joao@receitaprevisivel.ai';

-- Also add a more permissive policy for super admins to bypass tenant checks
DROP POLICY IF EXISTS "usuarios_access_existing" ON crm_usuarios;

CREATE POLICY "usuarios_access_existing" ON crm_usuarios
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = auth_user_id OR 
    is_super_admin() OR 
    (tenant_id IS NOT NULL AND tenant_id = get_current_user_tenant_id())
  );