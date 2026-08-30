-- CRITICAL SECURITY FIX: Phase 1 - Add missing RLS policies and secure public access
-- Fix existing policy conflicts and add missing ones

-- 1. Fix crm_stages policies (some may already exist)
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_stages' AND policyname = 'Enable read access for all users') THEN
        DROP POLICY "Enable read access for all users" ON public.crm_stages;
    END IF;
    
    -- Create new secure policies only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_stages' AND policyname = 'Users can view stages from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can view stages from their tenant"
        ON public.crm_stages
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_stages.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_stages' AND policyname = 'Users can insert stages in their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can insert stages in their tenant"
        ON public.crm_stages
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_stages.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_stages' AND policyname = 'Users can update stages from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can update stages from their tenant"
        ON public.crm_stages
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_stages.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_stages' AND policyname = 'Users can delete stages from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can delete stages from their tenant"
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
        )';
    END IF;
END $$;

-- 2. Fix crm_pipelines policies
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pipelines' AND policyname = 'Enable read access for all users') THEN
        DROP POLICY "Enable read access for all users" ON public.crm_pipelines;
    END IF;
    
    -- Create new secure policies only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pipelines' AND policyname = 'Users can view pipelines from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can view pipelines from their tenant"
        ON public.crm_pipelines
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_pipelines.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pipelines' AND policyname = 'Users can insert pipelines in their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can insert pipelines in their tenant"
        ON public.crm_pipelines
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_pipelines.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pipelines' AND policyname = 'Users can update pipelines from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can update pipelines from their tenant"
        ON public.crm_pipelines
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_pipelines.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pipelines' AND policyname = 'Users can delete pipelines from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can delete pipelines from their tenant"
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
        )';
    END IF;
END $$;

-- 3. Add RLS policies for tables that have RLS enabled but no policies
-- Check if table has RLS enabled and add policies only if missing

-- crm_pessoa_empresas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pessoa_empresas' AND policyname = 'Users can view pessoa_empresas from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can view pessoa_empresas from their tenant"
        ON public.crm_pessoa_empresas
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_pessoa_empresas.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pessoa_empresas' AND policyname = 'Users can insert pessoa_empresas in their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can insert pessoa_empresas in their tenant"
        ON public.crm_pessoa_empresas
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_pessoa_empresas.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pessoa_empresas' AND policyname = 'Users can update pessoa_empresas from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can update pessoa_empresas from their tenant"
        ON public.crm_pessoa_empresas
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_pessoa_empresas.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pessoa_empresas' AND policyname = 'Users can delete pessoa_empresas from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can delete pessoa_empresas from their tenant"
        ON public.crm_pessoa_empresas
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_pessoa_empresas.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
END $$;

-- crm_usuarios_times
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_usuarios_times' AND policyname = 'Users can view usuarios_times from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can view usuarios_times from their tenant"
        ON public.crm_usuarios_times
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_usuarios_times.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_usuarios_times' AND policyname = 'Users can insert usuarios_times in their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can insert usuarios_times in their tenant"
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
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_usuarios_times' AND policyname = 'Users can update usuarios_times from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can update usuarios_times from their tenant"
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
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_usuarios_times' AND policyname = 'Users can delete usuarios_times from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can delete usuarios_times from their tenant"
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
        )';
    END IF;
END $$;

-- crm_times
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_times' AND policyname = 'Users can view times from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can view times from their tenant"
        ON public.crm_times
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_times.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_times' AND policyname = 'Users can insert times in their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can insert times in their tenant"
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
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_times' AND policyname = 'Users can update times from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can update times from their tenant"
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
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_times' AND policyname = 'Users can delete times from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can delete times from their tenant"
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
        )';
    END IF;
END $$;

-- crm_pessoas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pessoas' AND policyname = 'Users can view pessoas from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can view pessoas from their tenant"
        ON public.crm_pessoas
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_pessoas.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pessoas' AND policyname = 'Users can insert pessoas in their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can insert pessoas in their tenant"
        ON public.crm_pessoas
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_pessoas.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pessoas' AND policyname = 'Users can update pessoas from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can update pessoas from their tenant"
        ON public.crm_pessoas
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_pessoas.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        )';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pessoas' AND policyname = 'Users can delete pessoas from their tenant') THEN
        EXECUTE 'CREATE POLICY "Users can delete pessoas from their tenant"
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
        )';
    END IF;
END $$;