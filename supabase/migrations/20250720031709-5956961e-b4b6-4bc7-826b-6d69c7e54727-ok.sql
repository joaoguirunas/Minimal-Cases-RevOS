-- FORÇAR isolamento total removendo política de DELETE permissiva para super admins

-- Remover política permissiva de DELETE 
DROP POLICY IF EXISTS "Gestores e admins podem deletar negocios" ON crm_leads;

-- Criar nova política mais restritiva para DELETE apenas no próprio tenant
CREATE POLICY "crm_leads_tenant_isolation_delete" ON crm_leads
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_leads.tenant_id
    AND crm_usuarios.ativo = true
    AND (crm_usuarios.gestor = true OR crm_usuarios.super_adm = true)
  )
);