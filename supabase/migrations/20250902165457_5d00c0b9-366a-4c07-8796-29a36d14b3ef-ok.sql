-- DROPAR E RECRIAR A FUNÇÃO get_user_available_tenants
-- ========================================================================

-- 1. CORRIGIR PERFIL DA RAFAELA PRIMEIRO
UPDATE crm_usuarios 
SET 
  gestor = true,
  tenant_id = (SELECT id FROM crm_tenants WHERE value = 'iatize' LIMIT 1)
WHERE auth_user_id = '77234261-18b8-497b-adee-172124ebc4f9'::uuid;

-- 2. DROPAR FUNÇÃO EXISTENTE
DROP FUNCTION IF EXISTS public.get_user_available_tenants();

-- 3. RECRIAR FUNÇÃO COM ESTRUTURA CORRETA
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
DECLARE
  current_user_email text;
  is_super_admin boolean := false;
BEGIN
  -- Verificar se é super admin por email primeiro
  SELECT email INTO current_user_email 
  FROM auth.users 
  WHERE id = auth.uid();
  
  -- Verificar se é super admin específico
  IF current_user_email IN ('rafaela@iatize.com', 'joao@iatize.com') THEN
    is_super_admin := true;
  ELSE
    -- Verificar na tabela crm_usuarios
    SELECT COALESCE(cu.super_adm, false) INTO is_super_admin
    FROM crm_usuarios cu
    WHERE cu.auth_user_id = auth.uid() 
      AND cu.ativo = true;
  END IF;
  
  -- Super admins veem todos os tenants ativos
  IF is_super_admin THEN
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
  
  -- Log para debug
  RAISE LOG 'get_user_available_tenants: user=%, email=%, is_super_admin=%', 
    auth.uid(), current_user_email, is_super_admin;
    
END;
$$;