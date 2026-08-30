-- COMPREHENSIVE SECURITY FIX: Implement RLS policies for all exposed tables
-- This fixes the critical vulnerabilities identified in the security scan

-- 1. SECURE crm_pessoas table (currently publicly readable)
-- Drop any existing insecure policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_pessoas;
DROP POLICY IF EXISTS "Public read access" ON public.crm_pessoas;

-- Create secure policies for crm_pessoas
CREATE POLICY "Secure: Users can view pessoas from their tenant"
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

CREATE POLICY "Secure: Users can insert pessoas in their tenant"
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

CREATE POLICY "Secure: Users can update pessoas from their tenant"
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

CREATE POLICY "Secure: Users can delete pessoas from their tenant"
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

-- 2. SECURE crm_usuarios table (currently publicly readable)
-- Drop any existing insecure policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_usuarios;
DROP POLICY IF EXISTS "Public read access" ON public.crm_usuarios;

-- Create secure policies for crm_usuarios
CREATE POLICY "Secure: Users can view usuarios from their tenant"
ON public.crm_usuarios
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_usuarios.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Secure: Managers can insert usuarios in their tenant"
ON public.crm_usuarios
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_usuarios.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

CREATE POLICY "Secure: Managers can update usuarios from their tenant"
ON public.crm_usuarios
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_usuarios.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true OR u.id = crm_usuarios.id)
  )
);

CREATE POLICY "Secure: Managers can delete usuarios from their tenant"
ON public.crm_usuarios
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_usuarios.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

-- 3. ADD MISSING RLS POLICIES for crm_pessoa_empresas
CREATE POLICY "Secure: Users can view pessoa_empresas from their tenant"
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

CREATE POLICY "Secure: Users can insert pessoa_empresas in their tenant"
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

CREATE POLICY "Secure: Users can update pessoa_empresas from their tenant"
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

CREATE POLICY "Secure: Users can delete pessoa_empresas from their tenant"
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

-- 4. ADD MISSING RLS POLICIES for crm_times
CREATE POLICY "Secure: Users can view times from their tenant"
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

CREATE POLICY "Secure: Managers can insert times in their tenant"
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

CREATE POLICY "Secure: Managers can update times from their tenant"
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

CREATE POLICY "Secure: Managers can delete times from their tenant"
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

-- 5. ADD MISSING RLS POLICIES for crm_times_membros
CREATE POLICY "Secure: Users can view times_membros from their tenant"
ON public.crm_times_membros
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_times_membros.tenant_id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Secure: Managers can insert times_membros in their tenant"
ON public.crm_times_membros
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_times_membros.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

CREATE POLICY "Secure: Managers can update times_membros from their tenant"
ON public.crm_times_membros
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_times_membros.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

CREATE POLICY "Secure: Managers can delete times_membros from their tenant"
ON public.crm_times_membros
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_times_membros.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

-- 6. ADD MISSING RLS POLICIES for crm_usuarios_globais
CREATE POLICY "Secure: Only super admins can view usuarios_globais"
ON public.crm_usuarios_globais
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.super_adm = true
    AND u.ativo = true
  )
);

CREATE POLICY "Secure: Only super admins can insert usuarios_globais"
ON public.crm_usuarios_globais
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.super_adm = true
    AND u.ativo = true
  )
);

CREATE POLICY "Secure: Only super admins can update usuarios_globais"
ON public.crm_usuarios_globais
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.super_adm = true
    AND u.ativo = true
  )
);

CREATE POLICY "Secure: Only super admins can delete usuarios_globais"
ON public.crm_usuarios_globais
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.super_adm = true
    AND u.ativo = true
  )
);

-- 7. ADD MISSING RLS POLICIES for crm_tenants
CREATE POLICY "Secure: Users can view their own tenant or all if super admin"
ON public.crm_tenants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_tenants.id OR u.super_adm = true)
    AND u.ativo = true
  )
);

CREATE POLICY "Secure: Only super admins can insert tenants"
ON public.crm_tenants
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.super_adm = true
    AND u.ativo = true
  )
);

CREATE POLICY "Secure: Only super admins can update tenants"
ON public.crm_tenants
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.super_adm = true
    AND u.ativo = true
  )
);

CREATE POLICY "Secure: Only super admins can delete tenants"
ON public.crm_tenants
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.super_adm = true
    AND u.ativo = true
  )
);

-- 8. SECURE DATABASE FUNCTIONS - Add proper search path to prevent schema poisoning
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

CREATE OR REPLACE FUNCTION public.check_horario_disponivel(p_horario timestamp without time zone, p_usuario_id uuid, p_tenant_id uuid)
 RETURNS TABLE(horario_preferencia text, hora_inicio time without time zone, hora_fim time without time zone, tem_conflito boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
RETURN QUERY
SELECT 
TO_CHAR (p_horario, 'YYYY-MM-DD HH24:MI') AS horario_preferencia,
a.hora_inicio,
a.hora_fim,
true as tem_conflito
FROM
crm_agendamentos a
WHERE
a.usuario_id = p_usuario_id
AND a.tenant_id = p_tenant_id
AND a.data = p_horario::date
AND (p_horario::time, (p_horario::time + interval '1 hour'))
OVERLAPS (a.hora_inicio, a.hora_fim);
-- disponível-- Se não encontrou conflitos, retorna que está disponível
IF NOT FOUND THEN
RETURN QUERY
SELECT
TO_CHAR (p_horario, 'YYYY-MM-DD HH24:MI'),
NULL::time,
NULL::time,
false as tem_conflito;
END IF;
END;
$function$;