-- Corrigir definitivamente as políticas RLS para crm_pessoas
-- Primeiro garantir que a tabela existe e tem RLS habilitado
ALTER TABLE crm_pessoas ENABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas existentes para crm_pessoas
DROP POLICY IF EXISTS "Users can create people in their tenant" ON crm_pessoas;
DROP POLICY IF EXISTS "Users can update people from their tenant" ON crm_pessoas;
DROP POLICY IF EXISTS "Users can view people from their tenant" ON crm_pessoas;
DROP POLICY IF EXISTS "Managers can delete people from their tenant" ON crm_pessoas;
DROP POLICY IF EXISTS "Users can insert people in their tenant" ON crm_pessoas;

-- Criar políticas corretas para crm_pessoas
CREATE POLICY "crm_pessoas_select_policy" ON crm_pessoas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (crm_usuarios.tenant_id = crm_pessoas.tenant_id OR crm_usuarios.super_adm = true)
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_pessoas_insert_policy" ON crm_pessoas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (crm_usuarios.tenant_id = crm_pessoas.tenant_id OR crm_usuarios.super_adm = true)
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_pessoas_update_policy" ON crm_pessoas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (crm_usuarios.tenant_id = crm_pessoas.tenant_id OR crm_usuarios.super_adm = true)
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_pessoas_delete_policy" ON crm_pessoas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (crm_usuarios.tenant_id = crm_pessoas.tenant_id OR crm_usuarios.super_adm = true)
    AND (crm_usuarios.gestor = true OR crm_usuarios.super_adm = true)
    AND crm_usuarios.ativo = true
  )
);

-- Corrigir políticas para crm_empresas também
ALTER TABLE crm_empresas ENABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas existentes para crm_empresas
DROP POLICY IF EXISTS "Users can create companies in their tenant" ON crm_empresas;
DROP POLICY IF EXISTS "Users can update companies from their tenant" ON crm_empresas;
DROP POLICY IF EXISTS "Users can view companies from their tenant" ON crm_empresas;
DROP POLICY IF EXISTS "Managers can delete companies from their tenant" ON crm_empresas;
DROP POLICY IF EXISTS "Users can insert companies in their tenant" ON crm_empresas;

-- Criar políticas corretas para crm_empresas
CREATE POLICY "crm_empresas_select_policy" ON crm_empresas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (crm_usuarios.tenant_id = crm_empresas.tenant_id OR crm_usuarios.super_adm = true)
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_empresas_insert_policy" ON crm_empresas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (crm_usuarios.tenant_id = crm_empresas.tenant_id OR crm_usuarios.super_adm = true)
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_empresas_update_policy" ON crm_empresas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (crm_usuarios.tenant_id = crm_empresas.tenant_id OR crm_usuarios.super_adm = true)
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_empresas_delete_policy" ON crm_empresas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (crm_usuarios.tenant_id = crm_empresas.tenant_id OR crm_usuarios.super_adm = true)
    AND (crm_usuarios.gestor = true OR crm_usuarios.super_adm = true)
    AND crm_usuarios.ativo = true
  )
);

-- Corrigir políticas para crm_pessoa_empresas (tabela de relacionamento)
ALTER TABLE crm_pessoa_empresas ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can manage pessoa_empresas in their tenant" ON crm_pessoa_empresas;

-- Criar política para crm_pessoa_empresas
CREATE POLICY "crm_pessoa_empresas_all_policy" ON crm_pessoa_empresas
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (crm_usuarios.tenant_id = crm_pessoa_empresas.tenant_id OR crm_usuarios.super_adm = true)
    AND crm_usuarios.ativo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (crm_usuarios.tenant_id = crm_pessoa_empresas.tenant_id OR crm_usuarios.super_adm = true)
    AND crm_usuarios.ativo = true
  )
);