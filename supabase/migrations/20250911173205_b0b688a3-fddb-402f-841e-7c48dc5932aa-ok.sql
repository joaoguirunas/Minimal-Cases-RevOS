-- CRITICAL SECURITY FIX: Phase 1 - Add missing RLS policies and secure public access

-- 1. Fix crm_stages - Remove public access and add proper RLS policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_stages;

CREATE POLICY "Users can view stages from their tenant"
ON public.crm_stages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_stages.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can insert stages in their tenant"
ON public.crm_stages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_stages.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can update stages from their tenant"
ON public.crm_stages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_stages.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can delete stages from their tenant"
ON public.crm_stages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_stages.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

-- 2. Fix crm_pipelines - Remove public access and add proper RLS policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_pipelines;

CREATE POLICY "Users can view pipelines from their tenant"
ON public.crm_pipelines
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pipelines.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can insert pipelines in their tenant"
ON public.crm_pipelines
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pipelines.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can update pipelines from their tenant"
ON public.crm_pipelines
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pipelines.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can delete pipelines from their tenant"
ON public.crm_pipelines
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pipelines.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

-- 3. Add missing RLS policies for crm_pessoa_empresas
CREATE POLICY "Users can view pessoa_empresas from their tenant"
ON public.crm_pessoa_empresas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pessoa_empresas.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can insert pessoa_empresas in their tenant"
ON public.crm_pessoa_empresas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pessoa_empresas.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can update pessoa_empresas from their tenant"
ON public.crm_pessoa_empresas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pessoa_empresas.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can delete pessoa_empresas from their tenant"
ON public.crm_pessoa_empresas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pessoa_empresas.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

-- 4. Add missing RLS policies for crm_usuarios_times
CREATE POLICY "Users can view usuarios_times from their tenant"
ON public.crm_usuarios_times
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_usuarios_times.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can insert usuarios_times in their tenant"
ON public.crm_usuarios_times
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_usuarios_times.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

CREATE POLICY "Users can update usuarios_times from their tenant"
ON public.crm_usuarios_times
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_usuarios_times.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

CREATE POLICY "Users can delete usuarios_times from their tenant"
ON public.crm_usuarios_times
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_usuarios_times.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

-- 5. Add missing RLS policies for crm_times
CREATE POLICY "Users can view times from their tenant"
ON public.crm_times
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_times.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can insert times in their tenant"
ON public.crm_times
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_times.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

CREATE POLICY "Users can update times from their tenant"
ON public.crm_times
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_times.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

CREATE POLICY "Users can delete times from their tenant"
ON public.crm_times
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_times.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

-- 6. Add missing RLS policies for crm_pessoas
CREATE POLICY "Users can view pessoas from their tenant"
ON public.crm_pessoas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pessoas.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can insert pessoas in their tenant"
ON public.crm_pessoas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pessoas.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can update pessoas from their tenant"
ON public.crm_pessoas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pessoas.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Users can delete pessoas from their tenant"
ON public.crm_pessoas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pessoas.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

-- 7. Fix database function security vulnerabilities
-- Add SET search_path to vulnerable functions

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

CREATE OR REPLACE FUNCTION public.debug_auth_context()
 RETURNS TABLE(current_user_id uuid, current_tenant_id uuid, session_valid boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as current_user_id,
    (SELECT tenant_id FROM crm_usuarios WHERE auth_user_id = auth.uid() LIMIT 1) as current_tenant_id,
    (auth.uid() IS NOT NULL) as session_valid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_whatsapp_exists_in_tenant(whatsapp_param text, tenant_id_param uuid, exclude_id_param uuid DEFAULT NULL::uuid)
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