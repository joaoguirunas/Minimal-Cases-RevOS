-- Fix infinite recursion in crm_usuarios RLS policies
-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can view users from their tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Users can update users in their tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Managers can create users in their tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Managers can delete users from their tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Users can view their own profile" ON crm_usuarios;
DROP POLICY IF EXISTS "Users can update their own profile" ON crm_usuarios;
DROP POLICY IF EXISTS "Super admins can view all users" ON crm_usuarios;
DROP POLICY IF EXISTS "Gestores podem ver usuários do tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Gestores podem atualizar usuários do tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Gestores podem criar usuários no tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Gestores podem deletar usuários do tenant" ON crm_usuarios;

-- Create ultra-simple policies that avoid recursion
-- Policy 1: Users can only see their own record + super admin exceptions
CREATE POLICY "crm_usuarios_simple_select" ON crm_usuarios
FOR SELECT USING (
  auth_user_id = auth.uid() OR
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- Policy 2: Users can only update their own record + super admin exceptions  
CREATE POLICY "crm_usuarios_simple_update" ON crm_usuarios
FOR UPDATE USING (
  auth_user_id = auth.uid() OR
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- Policy 3: Only super admins can insert new users
CREATE POLICY "crm_usuarios_simple_insert" ON crm_usuarios
FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- Policy 4: Only super admins can delete users
CREATE POLICY "crm_usuarios_simple_delete" ON crm_usuarios
FOR DELETE USING (
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);