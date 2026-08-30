-- Verificar e corrigir todas as políticas que ainda podem estar referenciando auth.users incorretamente

-- Verificar se há outras políticas problemáticas
SELECT 
  schemaname,
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies 
WHERE (qual LIKE '%users.email%' OR with_check LIKE '%users.email%')
   AND schemaname = 'public';

-- Corrigir quaisquer políticas que ainda referenciem auth.users em vez de crm_usuarios
-- Remover as políticas antigas que podem estar causando problemas

-- Corrigir políticas específicas para várias tabelas que podem ter o problema
DROP POLICY IF EXISTS "Users can delete basesconhecimento from their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can insert basesconhecimento in their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can update basesconhecimento from their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can view basesconhecimento from their tenant" ON crm_basesconhecimento;

-- Recriar políticas para crm_basesconhecimento usando apenas crm_usuarios
CREATE POLICY "Users can view bases from their tenant" ON crm_basesconhecimento
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_basesconhecimento.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can insert bases in their tenant" ON crm_basesconhecimento
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_basesconhecimento.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can update bases from their tenant" ON crm_basesconhecimento
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_basesconhecimento.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can delete bases from their tenant" ON crm_basesconhecimento
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_basesconhecimento.tenant_id OR super_adm = true)
    AND ativo = true
    AND (gestor = true OR super_adm = true)
  )
);

-- Corrigir políticas para crm_basesconhecimento_chunks
DROP POLICY IF EXISTS "Users can delete chunks from their tenant" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "Users can insert chunks in their tenant" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "Users can update chunks from their tenant" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "Users can view chunks from their tenant" ON crm_basesconhecimento_chunks;

CREATE POLICY "Users can view chunks from their tenant" ON crm_basesconhecimento_chunks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_basesconhecimento_chunks.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can insert chunks in their tenant" ON crm_basesconhecimento_chunks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_basesconhecimento_chunks.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can update chunks from their tenant" ON crm_basesconhecimento_chunks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_basesconhecimento_chunks.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can delete chunks from their tenant" ON crm_basesconhecimento_chunks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_basesconhecimento_chunks.tenant_id OR super_adm = true)
    AND ativo = true
    AND (gestor = true OR super_adm = true)
  )
);