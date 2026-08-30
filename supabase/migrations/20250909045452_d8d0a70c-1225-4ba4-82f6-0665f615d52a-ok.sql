-- Corrigir erro de permissão na tabela users
-- O problema são as políticas RLS que fazem referência direta à auth.users

-- Primeiro, verificar quais políticas ainda fazem referência à auth.users com emails
DO $$ 
BEGIN
  RAISE NOTICE 'Verificando políticas problemáticas...';
END $$;

-- Remover políticas problemáticas da tabela crm_basesconhecimento_chunks
DROP POLICY IF EXISTS "Users can delete chunks from their tenant" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "Users can insert chunks in their tenant" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "Users can update chunks from their tenant" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "Users can view chunks from their tenant" ON crm_basesconhecimento_chunks;

-- Recriar políticas sem referência direta à auth.users
CREATE POLICY "Users can view chunks from their tenant" 
ON crm_basesconhecimento_chunks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND ((crm_usuarios.tenant_id = crm_basesconhecimento_chunks.tenant_id) OR (crm_usuarios.super_adm = true))
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can insert chunks in their tenant" 
ON crm_basesconhecimento_chunks 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND ((crm_usuarios.tenant_id = crm_basesconhecimento_chunks.tenant_id) OR (crm_usuarios.super_adm = true))
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can update chunks from their tenant" 
ON crm_basesconhecimento_chunks 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND ((crm_usuarios.tenant_id = crm_basesconhecimento_chunks.tenant_id) OR (crm_usuarios.super_adm = true))
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can delete chunks from their tenant" 
ON crm_basesconhecimento_chunks 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND ((crm_usuarios.tenant_id = crm_basesconhecimento_chunks.tenant_id) OR (crm_usuarios.super_adm = true))
    AND crm_usuarios.ativo = true
  )
);

-- Corrigir outras políticas problemáticas se existirem
DROP POLICY IF EXISTS "Users can delete campanha_contatos from their tenant" ON crm_campanha_contatos;
DROP POLICY IF EXISTS "Users can insert campanha_contatos in their tenant" ON crm_campanha_contatos;
DROP POLICY IF EXISTS "Users can update campanha_contatos from their tenant" ON crm_campanha_contatos;
DROP POLICY IF EXISTS "Users can view campanha_contatos from their tenant" ON crm_campanha_contatos;

-- Recriar para campanha_contatos
CREATE POLICY "Users can view campanha_contatos from their tenant" 
ON crm_campanha_contatos 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND ((crm_usuarios.tenant_id = crm_campanha_contatos.tenant_id) OR (crm_usuarios.super_adm = true))
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can insert campanha_contatos in their tenant" 
ON crm_campanha_contatos 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND ((crm_usuarios.tenant_id = crm_campanha_contatos.tenant_id) OR (crm_usuarios.super_adm = true))
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can update campanha_contatos from their tenant" 
ON crm_campanha_contatos 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND ((crm_usuarios.tenant_id = crm_campanha_contatos.tenant_id) OR (crm_usuarios.super_adm = true))
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can delete campanha_contatos from their tenant" 
ON crm_campanha_contatos 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND ((crm_usuarios.tenant_id = crm_campanha_contatos.tenant_id) OR (crm_usuarios.super_adm = true))
    AND crm_usuarios.ativo = true
  )
);

-- Fazer o mesmo para campanhas
DROP POLICY IF EXISTS "Users can delete campanhas from their tenant" ON crm_campanhas;
DROP POLICY IF EXISTS "Users can insert campanhas in their tenant" ON crm_campanhas;
DROP POLICY IF EXISTS "Users can update campanhas from their tenant" ON crm_campanhas;
DROP POLICY IF EXISTS "Users can view campanhas from their tenant" ON crm_campanhas;

CREATE POLICY "Users can view campanhas from their tenant" 
ON crm_campanhas 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND ((crm_usuarios.tenant_id = crm_campanhas.tenant_id) OR (crm_usuarios.super_adm = true))
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can insert campanhas in their tenant" 
ON crm_campanhas 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND ((crm_usuarios.tenant_id = crm_campanhas.tenant_id) OR (crm_usuarios.super_adm = true))
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can update campanhas from their tenant" 
ON crm_campanhas 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND ((crm_usuarios.tenant_id = crm_campanhas.tenant_id) OR (crm_usuarios.super_adm = true))
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can delete campanhas from their tenant" 
ON crm_campanhas 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND ((crm_usuarios.tenant_id = crm_campanhas.tenant_id) OR (crm_usuarios.super_adm = true))
    AND crm_usuarios.ativo = true
  )
);

-- Log final
DO $$ 
BEGIN
  RAISE NOTICE 'Políticas RLS corrigidas - removidas referências diretas à tabela auth.users';
END $$;