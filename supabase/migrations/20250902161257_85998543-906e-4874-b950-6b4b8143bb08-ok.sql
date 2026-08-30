-- =====================================================
-- CRITICAL FIX: Remove infinite recursion in RLS policies
-- =====================================================

-- First, disable RLS temporarily to ensure clean operations
ALTER TABLE crm_usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tenants DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies that might cause recursion
DROP POLICY IF EXISTS "user_tenant_access_improved" ON crm_tenants;
DROP POLICY IF EXISTS "super_admin_full_access_fixed" ON crm_tenants;
DROP POLICY IF EXISTS "managers_update_tenants" ON crm_tenants;
DROP POLICY IF EXISTS "super_admin_create_tenants" ON crm_tenants;
DROP POLICY IF EXISTS "super_admin_delete_tenants" ON crm_tenants;

-- Drop problematic crm_usuarios policies
DROP POLICY IF EXISTS "crm_usuarios_tenant_isolation_select" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_tenant_isolation_update" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_tenant_isolation_insert" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_tenant_isolation_delete" ON crm_usuarios;

-- =====================================================
-- Create safe security definer functions
-- =====================================================

-- Function to get current user data without recursion
CREATE OR REPLACE FUNCTION public.get_current_user_data()
RETURNS TABLE(
  user_id uuid,
  tenant_id uuid,
  is_super_admin boolean,
  is_manager boolean,
  is_active boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    u.id,
    u.tenant_id,
    COALESCE(u.super_adm, false),
    COALESCE(u.gestor, false),
    COALESCE(u.ativo, true)
  FROM crm_usuarios u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin_safe()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT super_adm FROM crm_usuarios WHERE auth_user_id = auth.uid() LIMIT 1),
    false
  );
$$;

-- Function to get user tenant safely
CREATE OR REPLACE FUNCTION public.get_current_user_tenant_safe()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id FROM crm_usuarios WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- =====================================================
-- Create new safe RLS policies for crm_usuarios
-- =====================================================

-- Re-enable RLS for usuarios
ALTER TABLE crm_usuarios ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: Users can view their own profile + super admins can view all
CREATE POLICY "usuarios_safe_select" ON crm_usuarios
FOR SELECT USING (
  auth_user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = 'rafaela@iatize.com'
  )
);

-- Policy for INSERT: Only super admins can create users
CREATE POLICY "usuarios_safe_insert" ON crm_usuarios
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = 'rafaela@iatize.com'
  )
  OR is_current_user_super_admin_safe()
);

-- Policy for UPDATE: Users can update themselves, super admins can update all
CREATE POLICY "usuarios_safe_update" ON crm_usuarios
FOR UPDATE USING (
  auth_user_id = auth.uid()
  OR is_current_user_super_admin_safe()
  OR EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = 'rafaela@iatize.com'
  )
);

-- Policy for DELETE: Only super admins can delete
CREATE POLICY "usuarios_safe_delete" ON crm_usuarios
FOR DELETE USING (
  is_current_user_super_admin_safe()
  OR EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = 'rafaela@iatize.com'
  )
);

-- =====================================================
-- Create new safe RLS policies for crm_tenants
-- =====================================================

-- Re-enable RLS for tenants
ALTER TABLE crm_tenants ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: Users can see their tenant + super admins see all
CREATE POLICY "tenants_safe_select" ON crm_tenants
FOR SELECT USING (
  id = get_current_user_tenant_safe()
  OR is_current_user_super_admin_safe()
  OR EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = 'rafaela@iatize.com'
  )
);

-- Policy for INSERT: Only super admins can create tenants
CREATE POLICY "tenants_safe_insert" ON crm_tenants
FOR INSERT WITH CHECK (
  is_current_user_super_admin_safe()
  OR EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = 'rafaela@iatize.com'
  )
);

-- Policy for UPDATE: Managers can update their tenant, super admins can update all
CREATE POLICY "tenants_safe_update" ON crm_tenants
FOR UPDATE USING (
  (id = get_current_user_tenant_safe() AND (
    SELECT gestor FROM crm_usuarios WHERE auth_user_id = auth.uid() LIMIT 1
  ))
  OR is_current_user_super_admin_safe()
  OR EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = 'rafaela@iatize.com'
  )
);

-- Policy for DELETE: Only super admins can delete tenants
CREATE POLICY "tenants_safe_delete" ON crm_tenants
FOR DELETE USING (
  is_current_user_super_admin_safe()
  OR EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = 'rafaela@iatize.com'
  )
);

-- =====================================================
-- Update existing helper functions to use safe patterns
-- =====================================================

-- Update the existing user_has_tenant_access function to be safer
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT 
        super_adm = true OR tenant_id = target_tenant_id
      FROM crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      LIMIT 1
    ),
    false
  );
$$;

-- Create function to get available tenants for current user
CREATE OR REPLACE FUNCTION public.get_user_available_tenants()
RETURNS TABLE(
  id uuid,
  name text,
  value text,
  webhook_conversas text,
  modulos_ativos jsonb,
  ativo boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH user_data AS (
    SELECT 
      u.tenant_id,
      COALESCE(u.super_adm, false) as is_super_admin,
      COALESCE(u.ativo, true) as is_active
    FROM crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1
  )
  SELECT 
    t.id,
    t.name,
    t.value,
    t.webhook_conversas,
    t.modulos_ativos,
    t.ativo,
    t.created_at
  FROM crm_tenants t, user_data ud
  WHERE t.ativo = true
    AND ud.is_active = true
    AND (
      ud.is_super_admin = true 
      OR t.id = ud.tenant_id
    )
  ORDER BY t.name;
$$;