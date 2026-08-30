-- CORREÇÃO COMPLETA DAS POLÍTICAS RLS - ELIMINAR RECURSÃO INFINITA
-- ========================================================================

-- 1. REMOVER TODAS AS POLÍTICAS PROBLEMÁTICAS DE crm_usuarios
DROP POLICY IF EXISTS "crm_usuarios_tenant_isolation_select" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_tenant_isolation_update" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_tenant_isolation_insert" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_tenant_isolation_delete" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_user_access" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_safe_select" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_safe_update" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_safe_insert" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_safe_delete" ON crm_usuarios;

-- 2. CRIAR POLÍTICAS RLS SIMPLES E SEGURAS PARA crm_usuarios
-- Baseadas apenas em auth.uid() e auth.users - SEM consultas à crm_usuarios

-- SELECT: Permite ver próprio registro + super admins específicos
CREATE POLICY "usuarios_safe_select" ON crm_usuarios
FOR SELECT
USING (
  auth_user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- UPDATE: Permite atualizar próprio registro + super admins específicos  
CREATE POLICY "usuarios_safe_update" ON crm_usuarios
FOR UPDATE
USING (
  auth_user_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
)
WITH CHECK (
  auth_user_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- INSERT: Permite criar usuários (super admins específicos + próprio registro)
CREATE POLICY "usuarios_safe_insert" ON crm_usuarios
FOR INSERT
WITH CHECK (
  auth_user_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- DELETE: Apenas super admins específicos
CREATE POLICY "usuarios_safe_delete" ON crm_usuarios
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- 3. ATUALIZAR FUNÇÃO user_has_tenant_access PARA SER MAIS SEGURA
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Verifica se o usuário é super admin específico primeiro
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM auth.users au 
      WHERE au.id = auth.uid() 
      AND au.email IN ('rafaela@iatize.com', 'joao@iatize.com')
    ) THEN true
    -- Senão verifica acesso ao tenant específico através de consulta simples
    WHEN EXISTS (
      SELECT 1 FROM crm_usuarios cu
      WHERE cu.auth_user_id = auth.uid() 
      AND cu.tenant_id = target_tenant_id 
      AND cu.ativo = true
    ) THEN true
    ELSE false
  END;
$$;

-- 4. ATUALIZAR FUNÇÃO get_user_available_tenants PARA SER MAIS ROBUSTA
CREATE OR REPLACE FUNCTION public.get_user_available_tenants()
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  tenant_value text,
  role text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super admins específicos veem todos os tenants
  IF EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email IN ('rafaela@iatize.com', 'joao@iatize.com')
  ) THEN
    RETURN QUERY
    SELECT 
      ct.id,
      ct.name,
      ct.value,
      'gestor'::text
    FROM crm_tenants ct
    WHERE ct.ativo = true
    ORDER BY ct.name;
  ELSE
    -- Usuários normais veem apenas seus tenants
    RETURN QUERY
    SELECT 
      ct.id,
      ct.name,
      ct.value,
      CASE WHEN cu.gestor THEN 'gestor' ELSE 'atendimento' END::text
    FROM crm_tenants ct
    INNER JOIN crm_usuarios cu ON cu.tenant_id = ct.id
    WHERE cu.auth_user_id = auth.uid() 
      AND cu.ativo = true 
      AND ct.ativo = true
    ORDER BY ct.name;
  END IF;
END;
$$;

-- 5. GARANTIR QUE rafaela@iatize.com TENHA REGISTRO NA crm_usuarios (SE NÃO EXISTIR)
INSERT INTO crm_usuarios (auth_user_id, nome, email, super_adm, gestor, ativo, tenant_id)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Rafa'),
  au.email,
  true,
  true,
  true,
  (SELECT id FROM crm_tenants WHERE value = 'iatize' LIMIT 1)
FROM auth.users au
WHERE au.email = 'rafaela@iatize.com'
  AND NOT EXISTS (
    SELECT 1 FROM crm_usuarios cu 
    WHERE cu.auth_user_id = au.id
  );

-- 6. LOG DE CONFIRMAÇÃO
DO $$
BEGIN
  RAISE LOG 'RLS policies para crm_usuarios recriadas com sucesso - recursão eliminada';
END;
$$;