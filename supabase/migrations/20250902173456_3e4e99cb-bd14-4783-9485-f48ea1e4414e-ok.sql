-- Corrigir recursão infinita nas políticas RLS com Security Definer Functions
-- Problema: As políticas fazem subqueries na própria tabela que está sendo consultada

-- 1. Criar funções SECURITY DEFINER para quebrar a recursão
CREATE OR REPLACE FUNCTION public.is_user_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = user_id 
    AND super_adm = true 
    AND ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id FROM crm_usuarios 
  WHERE auth_user_id = user_id 
  AND ativo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_user_manager_of_tenant(user_id uuid, check_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = user_id 
    AND tenant_id = check_tenant_id
    AND gestor = true 
    AND ativo = true
  );
$$;

-- 2. Remover políticas circulares e recriar com funções seguras
DROP POLICY IF EXISTS "Allow super admin and tenant users to view tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Only super admins can create tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Super admins and managers can update tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Only super admins can delete tenants" ON crm_tenants;

DROP POLICY IF EXISTS "Allow users to view profiles with tenant isolation" ON crm_usuarios;
DROP POLICY IF EXISTS "Allow profile updates with proper permissions" ON crm_usuarios;
DROP POLICY IF EXISTS "Allow user creation with proper permissions" ON crm_usuarios;
DROP POLICY IF EXISTS "Allow user deletion with proper permissions" ON crm_usuarios;

-- 3. Políticas RLS para crm_tenants usando funções SECURITY DEFINER
CREATE POLICY "Tenant access with secure functions"
ON crm_tenants FOR SELECT
USING (
  -- Super admins podem ver todos os tenants
  public.is_user_super_admin(auth.uid())
  OR
  -- Usuários podem ver apenas seu tenant
  id = public.get_user_tenant_id(auth.uid())
);

CREATE POLICY "Only super admins create tenants"
ON crm_tenants FOR INSERT
WITH CHECK (
  public.is_user_super_admin(auth.uid())
);

CREATE POLICY "Tenant update permissions"
ON crm_tenants FOR UPDATE
USING (
  -- Super admins podem atualizar qualquer tenant
  public.is_user_super_admin(auth.uid())
  OR
  -- Gestores podem atualizar apenas seu tenant
  public.is_user_manager_of_tenant(auth.uid(), id)
);

CREATE POLICY "Only super admins delete tenants"
ON crm_tenants FOR DELETE
USING (
  public.is_user_super_admin(auth.uid())
);

-- 4. Políticas RLS simplificadas para crm_usuarios
CREATE POLICY "User profile access"
ON crm_usuarios FOR SELECT
USING (
  -- Usuário pode ver seu próprio perfil
  auth_user_id = auth.uid()
  OR
  -- Super admins podem ver todos os perfis (usando função direta sem recursão)
  public.is_user_super_admin(auth.uid())
  OR
  -- Gestores podem ver usuários do mesmo tenant
  public.is_user_manager_of_tenant(auth.uid(), tenant_id)
);

CREATE POLICY "User profile updates"
ON crm_usuarios FOR UPDATE
USING (
  -- Usuário pode atualizar seu próprio perfil
  auth_user_id = auth.uid()
  OR
  -- Super admins podem atualizar qualquer perfil
  public.is_user_super_admin(auth.uid())
  OR
  -- Gestores podem atualizar usuários do mesmo tenant
  public.is_user_manager_of_tenant(auth.uid(), tenant_id)
);

CREATE POLICY "User creation permissions"
ON crm_usuarios FOR INSERT
WITH CHECK (
  -- Super admins podem criar qualquer usuário
  public.is_user_super_admin(auth.uid())
  OR
  -- Gestores podem criar usuários no seu tenant
  public.is_user_manager_of_tenant(auth.uid(), tenant_id)
);

CREATE POLICY "User deletion permissions"
ON crm_usuarios FOR DELETE
USING (
  -- Super admins podem deletar qualquer usuário (exceto eles mesmos)
  public.is_user_super_admin(auth.uid())
  AND auth_user_id != auth.uid()
  OR
  -- Gestores podem deletar usuários do mesmo tenant (exceto eles mesmos)
  public.is_user_manager_of_tenant(auth.uid(), tenant_id)
  AND auth_user_id != auth.uid()
);