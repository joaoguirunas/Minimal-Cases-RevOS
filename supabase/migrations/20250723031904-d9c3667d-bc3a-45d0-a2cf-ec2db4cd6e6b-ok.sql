
-- Remover política atual permissiva
DROP POLICY IF EXISTS "Users can insert agendamentos in their tenant" ON crm_agendamentos;

-- Criar nova política com validação de usuário
CREATE POLICY "Users can insert agendamentos with proper permissions" 
ON crm_agendamentos 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND tenant_id = crm_agendamentos.tenant_id
    AND (
      -- Super admin pode criar para qualquer usuário
      super_adm = true
      OR
      -- Gestor pode criar para qualquer usuário do tenant
      gestor = true
      OR
      -- Usuário comum só pode criar para si mesmo
      (gestor = false AND super_adm = false AND id = crm_agendamentos.usuario_id)
    )
  )
);
