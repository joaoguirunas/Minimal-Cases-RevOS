-- LIMPEZA COMPLETA E RECRIAÇÃO DAS POLÍTICAS RLS
-- ========================================================================

-- 1. DESABILITAR RLS TEMPORARIAMENTE PARA LIMPEZA COMPLETA
ALTER TABLE crm_usuarios DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER TODAS AS POLÍTICAS EXISTENTES DE crm_usuarios
DROP POLICY IF EXISTS "crm_usuarios_tenant_isolation_select" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_tenant_isolation_update" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_tenant_isolation_insert" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_tenant_isolation_delete" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_user_access" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_safe_select" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_safe_update" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_safe_insert" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_safe_delete" ON crm_usuarios;
DROP POLICY IF EXISTS "usuarios_safe_select" ON crm_usuarios;
DROP POLICY IF EXISTS "usuarios_safe_update" ON crm_usuarios;
DROP POLICY IF EXISTS "usuarios_safe_insert" ON crm_usuarios;
DROP POLICY IF EXISTS "usuarios_safe_delete" ON crm_usuarios;

-- 3. REATIVAR RLS
ALTER TABLE crm_usuarios ENABLE ROW LEVEL SECURITY;

-- 4. CRIAR POLÍTICAS RLS SIMPLES E SEGURAS
-- Baseadas APENAS em auth.uid() e auth.users - SEM consultas à crm_usuarios

-- SELECT: Próprio registro + super admins específicos
CREATE POLICY "usuarios_simple_select" ON crm_usuarios
FOR SELECT
USING (
  auth_user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- UPDATE: Próprio registro + super admins específicos  
CREATE POLICY "usuarios_simple_update" ON crm_usuarios
FOR UPDATE
USING (
  auth_user_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- INSERT: Próprio registro + super admins específicos
CREATE POLICY "usuarios_simple_insert" ON crm_usuarios
FOR INSERT
WITH CHECK (
  auth_user_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- DELETE: Apenas super admins específicos
CREATE POLICY "usuarios_simple_delete" ON crm_usuarios
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- 5. GARANTIR QUE rafaela@iatize.com TENHA REGISTRO (SEM RLS)
INSERT INTO crm_usuarios (auth_user_id, nome, email, super_adm, gestor, ativo, tenant_id)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Rafa'),
  au.email,
  true,
  true,
  true,
  (SELECT id FROM crm_tenants WHERE value = 'iatize' LIMIT 1)
FROM auth.users au
WHERE au.email = 'rafaela@iatize.com'
  AND NOT EXISTS (
    SELECT 1 FROM crm_usuarios cu 
    WHERE cu.auth_user_id = au.id
  );