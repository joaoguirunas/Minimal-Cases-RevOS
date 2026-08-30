
-- Corrigir políticas RLS para permitir acesso global de super admins aos negócios

-- 1. Atualizar política SELECT para permitir super admins verem todos os leads
DROP POLICY IF EXISTS "crm_leads_tenant_isolation_select" ON crm_leads;
CREATE POLICY "crm_leads_tenant_isolation_select" ON crm_leads
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_leads.tenant_id
    AND crm_usuarios.ativo = true
  )
  OR 
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.super_adm = true
    AND crm_usuarios.ativo = true
  )
);

-- 2. Atualizar política UPDATE para permitir super admins editarem todos os leads
DROP POLICY IF EXISTS "crm_leads_tenant_isolation_update" ON crm_leads;
CREATE POLICY "crm_leads_tenant_isolation_update" ON crm_leads
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_leads.tenant_id
    AND crm_usuarios.ativo = true
  )
  OR 
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.super_adm = true
    AND crm_usuarios.ativo = true
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_leads.tenant_id
    AND crm_usuarios.ativo = true
  )
  OR 
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.super_adm = true
    AND crm_usuarios.ativo = true
  )
);

-- 3. Verificar e corrigir também a política INSERT se necessário
DROP POLICY IF EXISTS "crm_leads_secure_insert" ON crm_leads;
CREATE POLICY "crm_leads_secure_insert" ON crm_leads
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_leads.tenant_id
    AND crm_usuarios.ativo = true
  )
  OR 
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.super_adm = true
    AND crm_usuarios.ativo = true
  )
);

-- 4. Verificar e corrigir política similar em crm_pessoas se necessário
DROP POLICY IF EXISTS "crm_pessoas_user_access" ON crm_pessoas;
CREATE POLICY "crm_pessoas_user_access" ON crm_pessoas
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_pessoas.tenant_id
    AND crm_usuarios.ativo = true
  )
  OR 
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.super_adm = true
    AND crm_usuarios.ativo = true
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_pessoas.tenant_id
    AND crm_usuarios.ativo = true
  )
  OR 
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.super_adm = true
    AND crm_usuarios.ativo = true
  )
);

-- 5. Verificar e corrigir política similar em crm_messages se necessário
DROP POLICY IF EXISTS "crm_messages_user_access" ON crm_messages;
CREATE POLICY "crm_messages_user_access" ON crm_messages
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_messages.tenant_id
    AND crm_usuarios.ativo = true
  )
  OR 
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.super_adm = true
    AND crm_usuarios.ativo = true
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_messages.tenant_id
    AND crm_usuarios.ativo = true
  )
  OR 
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.super_adm = true
    AND crm_usuarios.ativo = true
  )
);
