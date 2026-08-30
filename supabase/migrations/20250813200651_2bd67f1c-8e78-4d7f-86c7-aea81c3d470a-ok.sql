-- SECURITY FIX: Remove overly permissive public access policy for crm_usuarios table
-- This policy was allowing unrestricted access to employee data including emails, names, and phone numbers

-- First, let's check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'crm_usuarios';

-- Drop the dangerous public access policy
DROP POLICY IF EXISTS "Permitir acesso público aos usuários" ON public.crm_usuarios;

-- Keep the secure tenant-based policies that already exist:
-- 1. "allow_profile_creation" - allows users to create their own profile
-- 2. "users_can_read_own_profile" - users can only read their own profile  
-- 3. "users_can_update_own_profile" - users can only update their own profile

-- Add a secure policy for tenant isolation that allows:
-- - Super admins to access all users
-- - Managers to access users in their tenant
-- - Regular users to access only their own profile
CREATE POLICY "secure_tenant_based_access" ON public.crm_usuarios
FOR SELECT
TO authenticated
USING (
  -- User can see their own profile
  auth_user_id = auth.uid()
  OR
  -- Super admins can see all profiles
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid() 
    AND cu.super_adm = true 
    AND cu.ativo = true
  )
  OR
  -- Managers can see users from their tenant
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid()
    AND cu.tenant_id = crm_usuarios.tenant_id
    AND cu.gestor = true
    AND cu.ativo = true
  )
);

-- Add secure insert policy for creating users (only super admins and managers)
CREATE POLICY "secure_user_creation" ON public.crm_usuarios
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Super admins can create any user
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid() 
    AND cu.super_adm = true 
    AND cu.ativo = true
  )
  OR
  -- Managers can create users in their tenant
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid()
    AND cu.tenant_id = crm_usuarios.tenant_id
    AND cu.gestor = true
    AND cu.ativo = true
  )
  OR
  -- Allow self-registration (when auth_user_id matches current user)
  auth_user_id = auth.uid()
);

-- Add secure update policy 
CREATE POLICY "secure_user_updates" ON public.crm_usuarios
FOR UPDATE
TO authenticated
USING (
  -- User can update their own profile
  auth_user_id = auth.uid()
  OR
  -- Super admins can update any user
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid() 
    AND cu.super_adm = true 
    AND cu.ativo = true
  )
  OR
  -- Managers can update users in their tenant
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid()
    AND cu.tenant_id = crm_usuarios.tenant_id
    AND cu.gestor = true
    AND cu.ativo = true
  )
)
WITH CHECK (
  -- Same conditions for updates
  auth_user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid() 
    AND cu.super_adm = true 
    AND cu.ativo = true
  )
  OR
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid()
    AND cu.tenant_id = crm_usuarios.tenant_id
    AND cu.gestor = true
    AND cu.ativo = true
  )
);

-- Add secure delete policy (only super admins and managers)
CREATE POLICY "secure_user_deletion" ON public.crm_usuarios
FOR DELETE
TO authenticated
USING (
  -- Super admins can delete any user
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid() 
    AND cu.super_adm = true 
    AND cu.ativo = true
  )
  OR
  -- Managers can delete users in their tenant (except other managers/super admins)
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid()
    AND cu.tenant_id = crm_usuarios.tenant_id
    AND cu.gestor = true
    AND cu.ativo = true
    AND crm_usuarios.gestor = false
    AND crm_usuarios.super_adm = false
  )
);

-- Verify the new policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'crm_usuarios'
ORDER BY policyname;