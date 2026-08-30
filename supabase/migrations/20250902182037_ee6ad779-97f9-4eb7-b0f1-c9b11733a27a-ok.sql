-- Corrigir todas as políticas RLS que ainda referenciam a tabela auth.users

-- 1. Verificar e corrigir políticas para crm_llm_connections
DROP POLICY IF EXISTS "Only managers can manage llm connections" ON crm_llm_connections;

CREATE POLICY "Only managers can manage llm connections" ON crm_llm_connections
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_llm_connections.tenant_id OR super_adm = true)
    AND (gestor = true OR super_adm = true)
    AND ativo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_llm_connections.tenant_id OR super_adm = true)
    AND (gestor = true OR super_adm = true)
    AND ativo = true
  )
);

-- 2. Verificar e corrigir políticas para crm_llm_usage_logs
DROP POLICY IF EXISTS "Users can insert usage logs in their tenant" ON crm_llm_usage_logs;
DROP POLICY IF EXISTS "Users can view usage logs from their tenant" ON crm_llm_usage_logs;

CREATE POLICY "Users can view usage logs from their tenant" ON crm_llm_usage_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_llm_usage_logs.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can insert usage logs in their tenant" ON crm_llm_usage_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_llm_usage_logs.tenant_id OR super_adm = true)
    AND ativo = true
  )
);