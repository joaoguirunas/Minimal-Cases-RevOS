-- Drop existing function and recreate with correct signature
DROP FUNCTION IF EXISTS public.get_user_available_tenants();

CREATE OR REPLACE FUNCTION public.get_user_available_tenants()
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  role text,
  gestor boolean,
  super_adm boolean,
  ativo boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get current authenticated user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Return tenants based on user's permissions
  RETURN QUERY
  SELECT DISTINCT
    CASE 
      WHEN u.super_adm = true THEN t.id
      ELSE u.tenant_id
    END as tenant_id,
    CASE 
      WHEN u.super_adm = true THEN t.name
      ELSE (SELECT name FROM crm_tenants WHERE id = u.tenant_id)
    END as tenant_name,
    CASE 
      WHEN u.super_adm = true THEN 'super_admin'
      WHEN u.gestor = true THEN 'admin'
      ELSE 'user'
    END as role,
    u.gestor,
    u.super_adm,
    u.ativo
  FROM crm_usuarios u
  LEFT JOIN crm_tenants t ON (u.super_adm = true)
  WHERE u.auth_user_id = current_user_id
    AND u.ativo = true
    AND (
      u.super_adm = true 
      OR (u.tenant_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM crm_tenants ct 
        WHERE ct.id = u.tenant_id AND ct.ativo = true
      ))
    )
    AND (u.super_adm = false OR (u.super_adm = true AND t.ativo = true));
END;
$$;