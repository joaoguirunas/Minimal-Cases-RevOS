-- Limpar todas as políticas RLS conflitantes da tabela crm_pessoas
DROP POLICY IF EXISTS "crm_pessoas_tenant_isolation_select" ON crm_pessoas;
DROP POLICY IF EXISTS "crm_pessoas_tenant_isolation_insert" ON crm_pessoas;
DROP POLICY IF EXISTS "crm_pessoas_tenant_isolation_update" ON crm_pessoas;
DROP POLICY IF EXISTS "crm_pessoas_tenant_isolation_delete" ON crm_pessoas;
DROP POLICY IF EXISTS "Users can view pessoas from their tenant" ON crm_pessoas;
DROP POLICY IF EXISTS "Users can insert pessoas in their tenant" ON crm_pessoas;
DROP POLICY IF EXISTS "Users can update pessoas from their tenant" ON crm_pessoas;
DROP POLICY IF EXISTS "Users can delete pessoas from their tenant" ON crm_pessoas;

-- Criar políticas RLS limpas e consistentes para crm_pessoas
CREATE POLICY "crm_pessoas_select_policy" ON crm_pessoas
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_pessoas.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_pessoas_insert_policy" ON crm_pessoas
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_pessoas.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_pessoas_update_policy" ON crm_pessoas
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_pessoas.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "crm_pessoas_delete_policy" ON crm_pessoas
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_pessoas.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
    AND (crm_usuarios.gestor = true OR crm_usuarios.super_adm = true)
  )
);