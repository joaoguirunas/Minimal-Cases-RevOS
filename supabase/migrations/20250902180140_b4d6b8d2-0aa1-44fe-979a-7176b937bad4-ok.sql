-- Corrigir a função get_user_available_tenants para funcionar corretamente
CREATE OR REPLACE FUNCTION public.get_user_available_tenants()
RETURNS TABLE(tenant_id uuid, tenant_name text, tenant_value text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log para debug
  RAISE LOG 'get_user_available_tenants called for user: %', auth.uid();
  
  -- Verificar se é super admin primeiro
  IF EXISTS (
    SELECT 1 
    FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  ) THEN
    RAISE LOG 'User is super admin, returning all tenants';
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
    RAISE LOG 'User is normal user, returning specific tenants';
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