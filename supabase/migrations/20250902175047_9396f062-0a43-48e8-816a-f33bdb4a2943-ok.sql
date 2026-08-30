-- Correção definitiva das políticas RLS na tabela crm_tenants
-- STEP 1: Remover TODAS as políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "Users can view tenants from their tenant" ON crm_tenants;
DROP POLICY IF EXISTS "Only super admins can insert tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Users can update tenants from their tenant" ON crm_tenants;
DROP POLICY IF EXISTS "Only super admins can delete tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Super admins can view all tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Super admins can insert tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Super admins can update all tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Super admins can delete tenants" ON crm_tenants;

-- STEP 2: Recriar apenas as 4 políticas corretas usando funções SECURITY DEFINER
CREATE POLICY "Super admins can view all tenants" ON crm_tenants
  FOR SELECT USING (public.is_user_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert tenants" ON crm_tenants
  FOR INSERT WITH CHECK (public.is_user_super_admin(auth.uid()));

CREATE POLICY "Super admins can update all tenants" ON crm_tenants
  FOR UPDATE USING (public.is_user_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete tenants" ON crm_tenants
  FOR DELETE USING (public.is_user_super_admin(auth.uid()));

-- STEP 3: Verificar se a função is_user_super_admin existe e está correta
CREATE OR REPLACE FUNCTION public.is_user_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM crm_usuarios 
    WHERE auth_user_id = user_id 
    AND super_adm = true 
    AND ativo = true
  );
END;
$$;