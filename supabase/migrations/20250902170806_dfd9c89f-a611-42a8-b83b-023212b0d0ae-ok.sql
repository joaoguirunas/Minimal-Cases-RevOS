-- Fix RLS policies for crm_usuarios table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON crm_usuarios;
DROP POLICY IF EXISTS "Users can update their own profile" ON crm_usuarios;
DROP POLICY IF EXISTS "Super admins can view all users" ON crm_usuarios;
DROP POLICY IF EXISTS "Gestores podem ver usuários do tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Gestores podem atualizar usuários do tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Gestores podem criar usuários no tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Gestores podem deletar usuários do tenant" ON crm_usuarios;

-- Enable RLS if not already enabled
ALTER TABLE crm_usuarios ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own profile and users from their tenant
CREATE POLICY "Users can view users from their tenant" ON crm_usuarios
FOR SELECT USING (
  auth_user_id = auth.uid() OR
  super_adm = true OR
  (tenant_id IN (
    SELECT u.tenant_id FROM crm_usuarios u 
    WHERE u.auth_user_id = auth.uid() AND u.ativo = true
  )) OR
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- Policy for users to update their own profile and managers to update team members
CREATE POLICY "Users can update users in their tenant" ON crm_usuarios
FOR UPDATE USING (
  auth_user_id = auth.uid() OR
  super_adm = true OR
  (tenant_id IN (
    SELECT u.tenant_id FROM crm_usuarios u 
    WHERE u.auth_user_id = auth.uid() AND u.ativo = true AND (u.gestor = true OR u.super_adm = true)
  )) OR
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- Policy for creating new users (managers and super admins only)
CREATE POLICY "Managers can create users in their tenant" ON crm_usuarios
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.ativo = true 
    AND (u.super_adm = true OR (u.gestor = true AND u.tenant_id = crm_usuarios.tenant_id))
  ) OR
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- Policy for deleting users (managers and super admins only)
CREATE POLICY "Managers can delete users from their tenant" ON crm_usuarios
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.ativo = true 
    AND (u.super_adm = true OR (u.gestor = true AND u.tenant_id = crm_usuarios.tenant_id))
  ) OR
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);