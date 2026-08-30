-- Correção de nomenclatura nas políticas RLS e funções
-- Corrigir referências de crm_usuarios_times para crm_usuario_times

-- Primeiro, remover políticas RLS incorretas se existirem
DROP POLICY IF EXISTS "Users can view usuario times from their tenant" ON crm_usuarios_times;
DROP POLICY IF EXISTS "Users can insert usuario times in their tenant" ON crm_usuarios_times;
DROP POLICY IF EXISTS "Users can update usuario times from their tenant" ON crm_usuarios_times;
DROP POLICY IF EXISTS "Users can delete usuario times from their tenant" ON crm_usuarios_times;

-- Criar políticas RLS corretas para crm_usuario_times (tabela que realmente existe)
CREATE POLICY "Users can view usuario times from their tenant" 
ON crm_usuario_times 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_usuario_times.tenant_id OR super_adm = true) 
    AND ativo = true
  )
);

CREATE POLICY "Users can insert usuario times in their tenant" 
ON crm_usuario_times 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_usuario_times.tenant_id OR super_adm = true) 
    AND ativo = true 
    AND (gestor = true OR super_adm = true)
  )
);

CREATE POLICY "Users can update usuario times from their tenant" 
ON crm_usuario_times 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_usuario_times.tenant_id OR super_adm = true) 
    AND ativo = true 
    AND (gestor = true OR super_adm = true)
  )
);

CREATE POLICY "Users can delete usuario times from their tenant" 
ON crm_usuario_times 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_usuario_times.tenant_id OR super_adm = true) 
    AND ativo = true 
    AND (gestor = true OR super_adm = true)
  )
);