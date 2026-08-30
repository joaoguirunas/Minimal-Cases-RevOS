-- Corrigir políticas RLS para crm_agentes_ia
-- As políticas estão tentando acessar a tabela 'users' em vez de 'crm_usuarios'

DROP POLICY IF EXISTS "Users can delete agents from their tenant" ON crm_agentes_ia;
DROP POLICY IF EXISTS "Users can insert agents in their tenant" ON crm_agentes_ia;
DROP POLICY IF EXISTS "Users can update agents from their tenant" ON crm_agentes_ia;
DROP POLICY IF EXISTS "Users can view agents from their tenant" ON crm_agentes_ia;

-- Criar políticas RLS corretas para crm_agentes_ia
CREATE POLICY "Users can view agents from their tenant" ON crm_agentes_ia
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (
      crm_usuarios.tenant_id = crm_agentes_ia.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can insert agents in their tenant" ON crm_agentes_ia
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (
      crm_usuarios.tenant_id = crm_agentes_ia.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can update agents from their tenant" ON crm_agentes_ia
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (
      crm_usuarios.tenant_id = crm_agentes_ia.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can delete agents from their tenant" ON crm_agentes_ia
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE crm_usuarios.auth_user_id = auth.uid()
    AND (
      crm_usuarios.tenant_id = crm_agentes_ia.tenant_id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
    AND (crm_usuarios.gestor = true OR crm_usuarios.super_adm = true)
  )
);