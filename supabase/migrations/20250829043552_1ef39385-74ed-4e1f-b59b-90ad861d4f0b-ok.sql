-- Fix critical security vulnerability in crm_empresas table
-- Remove the dangerous policy that allows unrestricted access
DROP POLICY IF EXISTS "allow_all_empresas" ON crm_empresas;

-- Remove the other policy that uses an unreliable current_setting approach
DROP POLICY IF EXISTS "crm_empresas_tenant_isolation" ON crm_empresas;

-- Create secure policies that properly enforce tenant isolation
-- Users can only view companies from their own tenant
CREATE POLICY "Users can view companies from their tenant" 
ON crm_empresas 
FOR SELECT 
USING (user_has_tenant_access(tenant_id));

-- Users can create companies in their tenant
CREATE POLICY "Users can create companies in their tenant" 
ON crm_empresas 
FOR INSERT 
WITH CHECK (user_has_tenant_access(tenant_id));

-- Users can update companies from their tenant
CREATE POLICY "Users can update companies from their tenant" 
ON crm_empresas 
FOR UPDATE 
USING (user_has_tenant_access(tenant_id))
WITH CHECK (user_has_tenant_access(tenant_id));

-- Only managers and super admins can delete companies
CREATE POLICY "Managers can delete companies from their tenant" 
ON crm_empresas 
FOR DELETE 
USING (
  user_has_tenant_access(tenant_id) AND (
    is_user_super_admin() OR 
    is_user_manager_for_tenant(tenant_id)
  )
);