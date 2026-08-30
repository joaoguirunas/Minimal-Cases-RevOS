
-- Remover política atual de DELETE
DROP POLICY IF EXISTS "Gestores e admins podem deletar agendamentos" ON crm_agendamentos;

-- Criar nova política de DELETE com validação de status para bloqueios manuais
CREATE POLICY "Users can delete agendamentos with proper permissions" 
ON crm_agendamentos 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND tenant_id = crm_agendamentos.tenant_id
    AND (
      -- Super admin pode deletar qualquer agendamento
      super_adm = true
      OR
      -- Gestor pode deletar qualquer agendamento do tenant
      gestor = true
      OR
      -- Usuário comum só pode deletar seus próprios bloqueios manuais
      (gestor = false AND super_adm = false AND id = crm_agendamentos.usuario_id AND crm_agendamentos.status = 'bloqueio manual')
    )
  )
);
