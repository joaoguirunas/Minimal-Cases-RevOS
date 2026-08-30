-- Create the simplest possible RLS policies for crm_usuarios
-- Drop existing policies completely
DROP POLICY IF EXISTS "crm_usuarios_simple_select" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_simple_update" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_simple_insert" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_simple_delete" ON crm_usuarios;

-- Create ultra-minimal policies that avoid any table references
-- Policy 1: Users can only see their own record
CREATE POLICY "crm_usuarios_own_record_select" ON crm_usuarios
FOR SELECT USING (
  auth_user_id = auth.uid()
);

-- Policy 2: Users can only update their own record
CREATE POLICY "crm_usuarios_own_record_update" ON crm_usuarios
FOR UPDATE USING (
  auth_user_id = auth.uid()
);

-- Policy 3: Allow insert for authenticated users (temporarily permissive)
CREATE POLICY "crm_usuarios_authenticated_insert" ON crm_usuarios
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Policy 4: Allow delete for authenticated users (temporarily permissive)
CREATE POLICY "crm_usuarios_authenticated_delete" ON crm_usuarios
FOR DELETE USING (
  auth.uid() IS NOT NULL
);