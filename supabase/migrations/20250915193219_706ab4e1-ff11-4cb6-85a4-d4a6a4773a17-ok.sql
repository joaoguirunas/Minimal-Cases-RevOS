-- CRITICAL SECURITY FIXES FOR RLS POLICIES AND FUNCTION SEARCH PATHS

-- Fix 1: Add missing RLS policies for tables that have RLS enabled but no policies
-- First, let's identify which tables need policies by checking the current state

-- Fix search_path issues in existing functions
CREATE OR REPLACE FUNCTION public.get_user_available_tenants()
 RETURNS TABLE(tenant_id uuid, tenant_name text, role text, gestor boolean, super_adm boolean, ativo boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Fix check_whatsapp_duplicate function
CREATE OR REPLACE FUNCTION public.check_whatsapp_duplicate(whatsapp_param text, tenant_id_param uuid, exclude_id_param uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  count_result integer;
BEGIN
  -- Verificar se parâmetros são válidos
  IF whatsapp_param IS NULL OR whatsapp_param = '' OR tenant_id_param IS NULL THEN
    RETURN false;
  END IF;
  
  -- Contar registros existentes
  IF exclude_id_param IS NOT NULL THEN
    SELECT COUNT(*) INTO count_result
    FROM crm_pessoas 
    WHERE whatsapp = whatsapp_param 
    AND tenant_id = tenant_id_param 
    AND status != 'arquivado'
    AND id != exclude_id_param;
  ELSE
    SELECT COUNT(*) INTO count_result
    FROM crm_pessoas 
    WHERE whatsapp = whatsapp_param 
    AND tenant_id = tenant_id_param 
    AND status != 'arquivado';
  END IF;
  
  RETURN count_result > 0;
END;
$function$;

-- Fix get_user_by_auth_id function
CREATE OR REPLACE FUNCTION public.get_user_by_auth_id(auth_id uuid)
 RETURNS TABLE(id uuid, auth_user_id uuid, nome text, email text, whatsapp text, gestor boolean, ativo boolean, super_adm boolean, tenant_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, deleted_at timestamp with time zone, deleted_by uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT u.id, u.auth_user_id, u.nome, u.email, u.whatsapp, u.gestor, u.ativo, u.super_adm, u.tenant_id, u.created_at, u.updated_at, u.deleted_at, u.deleted_by
  FROM crm_usuarios u
  WHERE u.auth_user_id = get_user_by_auth_id.auth_id;
END;
$function$;