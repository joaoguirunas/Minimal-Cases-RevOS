-- Limpar políticas RLS duplicadas e corrigir função
-- 1. Remover políticas antigas que usam EXISTS diretamente
DROP POLICY IF EXISTS "Users can view tenants from their tenant" ON crm_tenants;
DROP POLICY IF EXISTS "Only super admins can insert tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Users can update tenants from their tenant" ON crm_tenants;
DROP POLICY IF EXISTS "Only super admins can delete tenants" ON crm_tenants;

-- 2. Corrigir função get_user_available_tenants para passar auth.uid() corretamente
CREATE OR REPLACE FUNCTION public.get_user_available_tenants()
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  tenant_value text,
  role text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se for super admin, retornar todos os tenants
  IF (SELECT public.is_user_super_admin(auth.uid())) THEN
    RETURN QUERY
    SELECT 
      t.id AS tenant_id,
      t.name AS tenant_name,
      t.value AS tenant_value,
      'super_admin'::text AS role
    FROM crm_tenants t
    WHERE t.ativo = true
    ORDER BY t.name;
  ELSE
    -- Se for usuário normal, retornar apenas tenants onde ele tem acesso
    RETURN QUERY
    SELECT 
      t.id AS tenant_id,
      t.name AS tenant_name,
      t.value AS tenant_value,
      CASE 
        WHEN u.gestor = true THEN 'gestor'::text
        ELSE 'usuario'::text
      END AS role
    FROM crm_tenants t
    INNER JOIN crm_usuarios u ON u.tenant_id = t.id
    WHERE u.auth_user_id = auth.uid()
      AND u.ativo = true
      AND t.ativo = true
    ORDER BY t.name;
  END IF;
END;
$$;