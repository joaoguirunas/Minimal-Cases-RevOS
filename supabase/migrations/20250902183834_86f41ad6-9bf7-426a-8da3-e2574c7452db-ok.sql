-- Corrigir políticas RLS da tabela crm_pessoa_empresas
DROP POLICY IF EXISTS "crm_pessoa_empresas_user_access" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can delete pessoa-empresas from their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can insert pessoa-empresas in their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can update pessoa-empresas from their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can view pessoa-empresas from their tenant" ON crm_pessoa_empresas;

-- Criar políticas RLS limpas para crm_pessoa_empresas
CREATE POLICY "crm_pessoa_empresas_select_policy" ON crm_pessoa_empresas
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_pessoa_empresas.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_pessoa_empresas_insert_policy" ON crm_pessoa_empresas
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_pessoa_empresas.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_pessoa_empresas_update_policy" ON crm_pessoa_empresas
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_pessoa_empresas.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_pessoa_empresas_delete_policy" ON crm_pessoa_empresas
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_pessoa_empresas.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
    AND (crm_usuarios.gestor = true OR crm_usuarios.super_adm = true)
  )
);

-- Corrigir políticas RLS da tabela crm_empresas (removendo referências a auth.users)
DROP POLICY IF EXISTS "crm_empresas_delete_policy" ON crm_empresas;
DROP POLICY IF EXISTS "crm_empresas_insert_policy" ON crm_empresas;
DROP POLICY IF EXISTS "crm_empresas_select_policy" ON crm_empresas;
DROP POLICY IF EXISTS "crm_empresas_update_policy" ON crm_empresas;

-- Recriar políticas RLS limpas para crm_empresas
CREATE POLICY "crm_empresas_select_policy" ON crm_empresas
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_empresas.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_empresas_insert_policy" ON crm_empresas
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_empresas.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_empresas_update_policy" ON crm_empresas
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_empresas.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_empresas_delete_policy" ON crm_empresas
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_empresas.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
    AND (crm_usuarios.gestor = true OR crm_usuarios.super_adm = true)
  )
);