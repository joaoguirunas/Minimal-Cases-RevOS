-- Corrigir políticas RLS circulares entre crm_tenants e crm_usuarios
-- Problema: crm_tenants depende de crm_usuarios mas crm_usuarios precisa de crm_tenants

-- 1. Remover políticas antigas que causam dependência circular
DROP POLICY IF EXISTS "Users can view tenants they belong to" ON crm_tenants;
DROP POLICY IF EXISTS "Users can insert tenants if gestor" ON crm_tenants;
DROP POLICY IF EXISTS "Users can update tenants if gestor" ON crm_tenants;
DROP POLICY IF EXISTS "Users can delete tenants if gestor" ON crm_tenants;

-- 2. Criar políticas RLS mais simples e diretas para crm_tenants
-- Política para SELECT: Super admins podem ver todos, outros usuários veem apenas seus tenants
CREATE POLICY "Allow super admin and tenant users to view tenants"
ON crm_tenants FOR SELECT
USING (
  -- Super admins podem ver todos os tenants
  auth.uid() IN (
    SELECT auth_user_id FROM crm_usuarios 
    WHERE super_adm = true AND ativo = true
  )
  OR
  -- Usuários normais só veem tenants onde eles estão registrados
  id IN (
    SELECT tenant_id FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND ativo = true
  )
);

-- Política para INSERT: Apenas super admins podem criar tenants
CREATE POLICY "Only super admins can create tenants"
ON crm_tenants FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT auth_user_id FROM crm_usuarios 
    WHERE super_adm = true AND ativo = true
  )
);

-- Política para UPDATE: Super admins podem atualizar todos, gestores podem atualizar seus tenants
CREATE POLICY "Super admins and managers can update tenants"
ON crm_tenants FOR UPDATE
USING (
  -- Super admins podem atualizar qualquer tenant
  auth.uid() IN (
    SELECT auth_user_id FROM crm_usuarios 
    WHERE super_adm = true AND ativo = true
  )
  OR
  -- Gestores podem atualizar apenas seu tenant
  id IN (
    SELECT tenant_id FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND gestor = true AND ativo = true
  )
);

-- Política para DELETE: Apenas super admins podem deletar tenants
CREATE POLICY "Only super admins can delete tenants"
ON crm_tenants FOR DELETE
USING (
  auth.uid() IN (
    SELECT auth_user_id FROM crm_usuarios 
    WHERE super_adm = true AND ativo = true
  )
);

-- 3. Otimizar as políticas RLS de crm_usuarios para evitar loops
-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can view their own profile and super admins can view all" ON crm_usuarios;
DROP POLICY IF EXISTS "Users can update their own profile" ON crm_usuarios;
DROP POLICY IF EXISTS "Super admins can insert users" ON crm_usuarios;
DROP POLICY IF EXISTS "Super admins can delete users" ON crm_usuarios;

-- Política otimizada para SELECT em crm_usuarios
CREATE POLICY "Allow users to view profiles with tenant isolation"
ON crm_usuarios FOR SELECT
USING (
  -- Usuário pode ver seu próprio perfil
  auth_user_id = auth.uid()
  OR
  -- Super admins podem ver todos os perfis
  auth.uid() IN (
    SELECT u.auth_user_id FROM crm_usuarios u 
    WHERE u.super_adm = true AND u.ativo = true
  )
  OR
  -- Gestores podem ver usuários do mesmo tenant
  tenant_id IN (
    SELECT u.tenant_id FROM crm_usuarios u 
    WHERE u.auth_user_id = auth.uid() AND u.gestor = true AND u.ativo = true
  )
);

-- Política para UPDATE em crm_usuarios
CREATE POLICY "Allow profile updates with proper permissions"
ON crm_usuarios FOR UPDATE
USING (
  -- Usuário pode atualizar seu próprio perfil
  auth_user_id = auth.uid()
  OR
  -- Super admins podem atualizar qualquer perfil
  auth.uid() IN (
    SELECT u.auth_user_id FROM crm_usuarios u 
    WHERE u.super_adm = true AND u.ativo = true
  )
  OR
  -- Gestores podem atualizar usuários do mesmo tenant
  tenant_id IN (
    SELECT u.tenant_id FROM crm_usuarios u 
    WHERE u.auth_user_id = auth.uid() AND u.gestor = true AND u.ativo = true
  )
);

-- Política para INSERT em crm_usuarios
CREATE POLICY "Allow user creation with proper permissions"
ON crm_usuarios FOR INSERT
WITH CHECK (
  -- Super admins podem criar qualquer usuário
  auth.uid() IN (
    SELECT u.auth_user_id FROM crm_usuarios u 
    WHERE u.super_adm = true AND u.ativo = true
  )
  OR
  -- Gestores podem criar usuários no seu tenant
  tenant_id IN (
    SELECT u.tenant_id FROM crm_usuarios u 
    WHERE u.auth_user_id = auth.uid() AND u.gestor = true AND u.ativo = true
  )
);

-- Política para DELETE em crm_usuarios
CREATE POLICY "Allow user deletion with proper permissions"
ON crm_usuarios FOR DELETE
USING (
  -- Super admins podem deletar qualquer usuário (exceto eles mesmos)
  auth.uid() IN (
    SELECT u.auth_user_id FROM crm_usuarios u 
    WHERE u.super_adm = true AND u.ativo = true
  )
  AND auth_user_id != auth.uid() -- Não pode deletar a si mesmo
  OR
  -- Gestores podem deletar usuários do mesmo tenant (exceto eles mesmos)
  tenant_id IN (
    SELECT u.tenant_id FROM crm_usuarios u 
    WHERE u.auth_user_id = auth.uid() AND u.gestor = true AND u.ativo = true
  )
  AND auth_user_id != auth.uid() -- Não pode deletar a si mesmo
);