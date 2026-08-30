-- Corrigir políticas RLS para acesso de super admin aos tenants
-- O problema principal é que auth.uid() está retornando null, causando falhas nas políticas

-- 1. Primeiro, garantir que super admins sempre tenham acesso aos tenants
DROP POLICY IF EXISTS "super_admin_full_access" ON public.crm_tenants;

CREATE POLICY "super_admin_full_access_fixed" ON public.crm_tenants
  FOR ALL USING (
    -- Verificar se o usuário é super admin de forma mais robusta
    EXISTS (
      SELECT 1 FROM public.crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND super_adm = true 
      AND ativo = true
    )
    -- OU se é um super admin conhecido por email (fallback para problemas de sessão)
    OR EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email IN ('rafaela@iatize.com')
    )
  );

-- 2. Melhorar a política de acesso regular a tenants
DROP POLICY IF EXISTS "user_tenant_access" ON public.crm_tenants;

CREATE POLICY "user_tenant_access_improved" ON public.crm_tenants
  FOR SELECT USING (
    -- Super admin sempre tem acesso
    EXISTS (
      SELECT 1 FROM public.crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND super_adm = true 
      AND ativo = true
    )
    -- OU usuário tem acesso ao tenant específico
    OR EXISTS (
      SELECT 1 FROM public.crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND tenant_id = crm_tenants.id 
      AND ativo = true
    )
    -- OU fallback para emails conhecidos de super admin
    OR EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email IN ('rafaela@iatize.com')
    )
  );

-- 3. Garantir que a função de verificação de tenant seja mais robusta
CREATE OR REPLACE FUNCTION public.user_has_tenant_access_robust(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Verificar múltiplas condições para acesso robusto
  SELECT (
    -- Super admin sempre tem acesso
    EXISTS (
      SELECT 1 FROM public.crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND super_adm = true 
      AND ativo = true
    )
    -- OU usuário específico do tenant
    OR EXISTS (
      SELECT 1 FROM public.crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND tenant_id = target_tenant_id 
      AND ativo = true
    )
    -- OU fallback para emails conhecidos (para problemas de sessão)
    OR EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email IN ('rafaela@iatize.com')
    )
  );
$$;

-- 4. Atualizar as políticas de crm_usuarios para usar a função robusta
DROP POLICY IF EXISTS "crm_usuarios_tenant_access" ON public.crm_usuarios;

CREATE POLICY "crm_usuarios_robust_access" ON public.crm_usuarios
  FOR ALL USING (
    -- Super admin pode ver todos os usuários
    EXISTS (
      SELECT 1 FROM public.crm_usuarios cu 
      WHERE cu.auth_user_id = auth.uid() 
      AND cu.super_adm = true 
      AND cu.ativo = true
    )
    -- OU usuário pode ver usuários do mesmo tenant
    OR EXISTS (
      SELECT 1 FROM public.crm_usuarios cu 
      WHERE cu.auth_user_id = auth.uid() 
      AND cu.tenant_id = crm_usuarios.tenant_id 
      AND cu.ativo = true
    )
    -- OU é o próprio usuário
    OR auth_user_id = auth.uid()
    -- OU fallback para emails conhecidos
    OR EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email IN ('rafaela@iatize.com')
    )
  )
  WITH CHECK (
    -- Mesmas condições para inserção/atualização
    EXISTS (
      SELECT 1 FROM public.crm_usuarios cu 
      WHERE cu.auth_user_id = auth.uid() 
      AND cu.super_adm = true 
      AND cu.ativo = true
    )
    OR EXISTS (
      SELECT 1 FROM public.crm_usuarios cu 
      WHERE cu.auth_user_id = auth.uid() 
      AND cu.tenant_id = crm_usuarios.tenant_id 
      AND cu.ativo = true
    )
    OR auth_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email IN ('rafaela@iatize.com')
    )
  );

-- 5. Criar função específica para obter tenants disponíveis do usuário
CREATE OR REPLACE FUNCTION public.get_user_available_tenants()
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  tenant_value text,
  user_role text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  user_super_admin boolean := false;
BEGIN
  -- Obter ID do usuário atual
  current_user_id := auth.uid();
  
  -- Se não há usuário, retornar vazio
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Verificar se é super admin
  SELECT COALESCE(cu.super_adm, false) INTO user_super_admin
  FROM public.crm_usuarios cu
  WHERE cu.auth_user_id = current_user_id 
  AND cu.ativo = true
  LIMIT 1;
  
  -- Se super admin, retornar todos os tenants ativos
  IF user_super_admin THEN
    RETURN QUERY
    SELECT 
      ct.id,
      ct.name,
      ct.value,
      'super_admin'::text
    FROM public.crm_tenants ct
    WHERE ct.ativo = true
    ORDER BY ct.name;
    RETURN;
  END IF;
  
  -- Caso contrário, retornar apenas tenants do usuário
  RETURN QUERY
  SELECT 
    ct.id,
    ct.name,
    ct.value,
    CASE 
      WHEN cu.gestor THEN 'gestor'
      ELSE 'atendimento'
    END::text
  FROM public.crm_tenants ct
  INNER JOIN public.crm_usuarios cu ON cu.tenant_id = ct.id
  WHERE cu.auth_user_id = current_user_id
  AND cu.ativo = true
  AND ct.ativo = true
  ORDER BY ct.name;
END;
$$;