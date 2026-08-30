-- Corrigir políticas RLS para crm_pessoas e crm_empresas
-- O problema é que ainda estão referenciando auth.users em vez de crm_usuarios

-- Remover políticas antigas para crm_pessoas
DROP POLICY IF EXISTS "Users can create people in their tenant" ON crm_pessoas;
DROP POLICY IF EXISTS "Users can update people from their tenant" ON crm_pessoas;
DROP POLICY IF EXISTS "Users can view people from their tenant" ON crm_pessoas;
DROP POLICY IF EXISTS "Managers can delete people from their tenant" ON crm_pessoas;

-- Criar políticas corretas para crm_pessoas
CREATE POLICY "Users can view people from their tenant" ON crm_pessoas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_pessoas.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can insert people in their tenant" ON crm_pessoas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_pessoas.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can update people from their tenant" ON crm_pessoas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_pessoas.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Managers can delete people from their tenant" ON crm_pessoas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_pessoas.tenant_id OR super_adm = true)
    AND (gestor = true OR super_adm = true)
    AND ativo = true
  )
);

-- Remover políticas antigas para crm_empresas
DROP POLICY IF EXISTS "Users can create companies in their tenant" ON crm_empresas;
DROP POLICY IF EXISTS "Users can update companies from their tenant" ON crm_empresas;
DROP POLICY IF EXISTS "Users can view companies from their tenant" ON crm_empresas;
DROP POLICY IF EXISTS "Managers can delete companies from their tenant" ON crm_empresas;

-- Criar políticas corretas para crm_empresas
CREATE POLICY "Users can view companies from their tenant" ON crm_empresas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_empresas.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can insert companies in their tenant" ON crm_empresas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_empresas.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can update companies from their tenant" ON crm_empresas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_empresas.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Managers can delete companies from their tenant" ON crm_empresas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_empresas.tenant_id OR super_adm = true)
    AND (gestor = true OR super_adm = true)
    AND ativo = true
  )
);

-- Verificar se há mais políticas problemáticas
SELECT 
  schemaname,
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies 
WHERE (qual LIKE '%users.email%' OR with_check LIKE '%users.email%')
   AND schemaname = 'public';