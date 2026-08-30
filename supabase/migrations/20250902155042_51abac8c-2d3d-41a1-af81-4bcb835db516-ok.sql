-- Corrigir políticas RLS da tabela crm_tenants para melhor compatibilidade

-- Primeiro, remover as políticas existentes que estão causando problemas
DROP POLICY IF EXISTS "secure_tenant_access" ON crm_tenants;
DROP POLICY IF EXISTS "secure_tenant_creation" ON crm_tenants;
DROP POLICY IF EXISTS "secure_tenant_deletion" ON crm_tenants;
DROP POLICY IF EXISTS "secure_tenant_updates" ON crm_tenants;

-- Criar políticas mais robustas que funcionam melhor com auth state

-- Super admins podem ver todos os tenants
CREATE POLICY "super_admin_full_access" ON crm_tenants
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  )
);

-- Usuários podem ver tenants onde são membros ou gestores
CREATE POLICY "user_tenant_access" ON crm_tenants
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (
      tenant_id = crm_tenants.id 
      OR super_adm = true
    )
    AND ativo = true
  )
);

-- Apenas super admins podem criar tenants
CREATE POLICY "super_admin_create_tenants" ON crm_tenants
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  )
);

-- Super admins podem deletar tenants
CREATE POLICY "super_admin_delete_tenants" ON crm_tenants
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  )
);

-- Super admins e gestores podem atualizar tenants
CREATE POLICY "managers_update_tenants" ON crm_tenants
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (
      super_adm = true 
      OR (tenant_id = crm_tenants.id AND gestor = true)
    )
    AND ativo = true
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (
      super_adm = true 
      OR (tenant_id = crm_tenants.id AND gestor = true)
    )
    AND ativo = true
  )
);