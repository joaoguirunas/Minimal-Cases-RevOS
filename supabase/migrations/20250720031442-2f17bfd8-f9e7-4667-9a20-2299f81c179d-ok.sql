-- CORREÇÃO URGENTE: Remover política insegura e aplicar isolamento completo de tenant

-- 1. Remover política que permite acesso sem validação de tenant
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON crm_leads;

-- 2. Remover política que permite super_adm ignorar tenant (muito permissiva)
DROP POLICY IF EXISTS "crm_leads_user_access" ON crm_leads;

-- 3. Criar política segura e restritiva para SELECT/UPDATE
CREATE POLICY "crm_leads_tenant_isolation_select" ON crm_leads
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_leads.tenant_id
    AND crm_usuarios.ativo = true
  )
);

-- 4. Criar política segura para INSERT com validação de tenant
CREATE POLICY "crm_leads_tenant_isolation_insert" ON crm_leads
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_leads.tenant_id
    AND crm_usuarios.ativo = true
  )
);

-- 5. Criar política segura para UPDATE com validação de tenant
CREATE POLICY "crm_leads_tenant_isolation_update" ON crm_leads
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_leads.tenant_id
    AND crm_usuarios.ativo = true
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_leads.tenant_id
    AND crm_usuarios.ativo = true
  )
);

-- 6. Manter política de DELETE para gestores (já segura)
-- Esta política já está correta e não precisa ser alterada