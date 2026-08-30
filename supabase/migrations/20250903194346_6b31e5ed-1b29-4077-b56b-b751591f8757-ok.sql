-- PHASE 2: Fix remaining security warnings

-- 1. Add missing RLS policies for tables that need them
-- Check if crm_pipelines needs policies (it should have been created in previous migration)
DO $$
BEGIN
  -- Add policies for crm_pipelines if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pipelines' AND policyname = 'Users can view pipelines from their tenant') THEN
    CREATE POLICY "Users can view pipelines from their tenant" 
    ON crm_pipelines 
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_pipelines.tenant_id OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pipelines' AND policyname = 'Managers can manage pipelines in their tenant') THEN
    CREATE POLICY "Managers can manage pipelines in their tenant" 
    ON crm_pipelines 
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_pipelines.tenant_id OR super_adm = true)
        AND (gestor = true OR super_adm = true)
        AND ativo = true
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_pipelines.tenant_id OR super_adm = true)
        AND (gestor = true OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;

  -- Add policies for crm_stages if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_stages' AND policyname = 'Users can view stages from their tenant') THEN
    CREATE POLICY "Users can view stages from their tenant" 
    ON crm_stages 
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_stages.tenant_id OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_stages' AND policyname = 'Managers can manage stages in their tenant') THEN
    CREATE POLICY "Managers can manage stages in their tenant" 
    ON crm_stages 
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_stages.tenant_id OR super_adm = true)
        AND (gestor = true OR super_adm = true)
        AND ativo = true
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_stages.tenant_id OR super_adm = true)
        AND (gestor = true OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;

  -- Add policies for crm_tenants if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_tenants' AND policyname = 'Users can view their tenant') THEN
    CREATE POLICY "Users can view their tenant" 
    ON crm_tenants 
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_tenants.id OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_tenants' AND policyname = 'Super admins can manage all tenants') THEN
    CREATE POLICY "Super admins can manage all tenants" 
    ON crm_tenants 
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND super_adm = true
        AND ativo = true
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND super_adm = true
        AND ativo = true
      )
    );
  END IF;

  -- Add policies for crm_usuarios_times if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_usuarios_times' AND policyname = 'Users can view team assignments from their tenant') THEN
    CREATE POLICY "Users can view team assignments from their tenant" 
    ON crm_usuarios_times 
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_usuarios_times.tenant_id OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_usuarios_times' AND policyname = 'Managers can manage team assignments in their tenant') THEN
    CREATE POLICY "Managers can manage team assignments in their tenant" 
    ON crm_usuarios_times 
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_usuarios_times.tenant_id OR super_adm = true)
        AND (gestor = true OR super_adm = true)
        AND ativo = true
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_usuarios_times.tenant_id OR super_adm = true)
        AND (gestor = true OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;

  -- Add policies for crm_times if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_times' AND policyname = 'Users can view teams from their tenant') THEN
    CREATE POLICY "Users can view teams from their tenant" 
    ON crm_times 
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_times.tenant_id OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_times' AND policyname = 'Managers can manage teams in their tenant') THEN
    CREATE POLICY "Managers can manage teams in their tenant" 
    ON crm_times 
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_times.tenant_id OR super_adm = true)
        AND (gestor = true OR super_adm = true)
        AND ativo = true
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_times.tenant_id OR super_adm = true)
        AND (gestor = true OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;
END
$$;

-- 2. Fix remaining database functions to have proper search_path
-- Update all functions mentioned in the security warnings

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_by_auth_id(auth_id uuid)
RETURNS TABLE(id uuid, auth_user_id uuid, nome text, email text, whatsapp text, gestor boolean, ativo boolean, super_adm boolean, tenant_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, deleted_at timestamp with time zone, deleted_by uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.auth_user_id, u.nome, u.email, u.whatsapp, u.gestor, u.ativo, u.super_adm, u.tenant_id, u.created_at, u.updated_at, u.deleted_at, u.deleted_by
  FROM crm_usuarios u
  WHERE u.auth_user_id = get_user_by_auth_id.auth_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_whatsapp_duplicate(whatsapp_param text, tenant_id_param uuid, exclude_id_param uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.migrate_campanhas_to_disparos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se o JSON contém 'campanhas' mas não 'disparos', migrar
  IF NEW.modulos_ativos ? 'campanhas' AND NOT NEW.modulos_ativos ? 'disparos' THEN
    NEW.modulos_ativos = jsonb_set(
      NEW.modulos_ativos - 'campanhas',
      '{disparos}',
      NEW.modulos_ativos->'campanhas'
    );
  END IF;
  RETURN NEW;
END;
$$;