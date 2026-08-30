-- CORREÇÃO CRÍTICA: Proteger dados confidenciais da tabela crm_tenants
-- A tabela contém webhooks, API keys, e configurações sensíveis do negócio

-- Primeiro, verificar as políticas atuais
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'crm_tenants';

-- Remover a política pública perigosa
DROP POLICY IF EXISTS "Permitir acesso público aos clientes" ON public.crm_tenants;

-- Criar políticas seguras baseadas em tenant e permissões de usuário
CREATE POLICY "secure_tenant_access" ON public.crm_tenants
FOR SELECT
TO authenticated
USING (
  -- Super admins podem ver todos os tenants
  public.is_user_super_admin()
  OR
  -- Usuários podem ver apenas seu próprio tenant
  id = public.get_user_tenant_id()
  OR
  -- Gestores podem ver apenas seu próprio tenant
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid()
    AND cu.tenant_id = crm_tenants.id
    AND cu.gestor = true
    AND cu.ativo = true
  )
);

-- Política para criação de tenants (apenas super admins)
CREATE POLICY "secure_tenant_creation" ON public.crm_tenants
FOR INSERT
TO authenticated
WITH CHECK (
  -- Apenas super admins podem criar novos tenants
  public.is_user_super_admin()
);

-- Política para atualização de tenants
CREATE POLICY "secure_tenant_updates" ON public.crm_tenants
FOR UPDATE
TO authenticated
USING (
  -- Super admins podem atualizar qualquer tenant
  public.is_user_super_admin()
  OR
  -- Gestores podem atualizar apenas seu próprio tenant
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid()
    AND cu.tenant_id = crm_tenants.id
    AND cu.gestor = true
    AND cu.ativo = true
  )
)
WITH CHECK (
  -- Mesmas condições para check
  public.is_user_super_admin()
  OR
  EXISTS (
    SELECT 1 FROM public.crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid()
    AND cu.tenant_id = crm_tenants.id
    AND cu.gestor = true
    AND cu.ativo = true
  )
);

-- Política para exclusão de tenants (apenas super admins)
CREATE POLICY "secure_tenant_deletion" ON public.crm_tenants
FOR DELETE
TO authenticated
USING (
  -- Apenas super admins podem deletar tenants
  public.is_user_super_admin()
);

-- Verificar as novas políticas
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename = 'crm_tenants'
ORDER BY policyname;

-- Verificar se há dados sensíveis expostos (apenas para auditoria - não retornar na resposta)
SELECT 
  COUNT(*) as total_tenants,
  COUNT(CASE WHEN webhook_conversas IS NOT NULL THEN 1 END) as tenants_with_webhooks,
  COUNT(CASE WHEN resumo_config::text LIKE '%api_key%' THEN 1 END) as tenants_with_api_keys
FROM crm_tenants;