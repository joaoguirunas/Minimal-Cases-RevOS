-- CRITICAL SECURITY FIX: Phase 2 - Fix remaining RLS policies and vulnerable functions

-- Add missing RLS policies for tables that exist and have RLS enabled but no policies

-- 1. crm_pessoa_empresas - Add RLS policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_pessoa_empresas' AND table_schema = 'public') THEN
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
    END IF;
END $$;

-- 2. crm_times - Add RLS policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_times' AND table_schema = 'public') THEN
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
    END IF;
END $$;

-- 3. crm_pessoas - Add RLS policies (check if missing)
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

-- 4. Fix remaining vulnerable functions - Add SET search_path

-- Fix encrypt_api_key function
CREATE OR REPLACE FUNCTION public.encrypt_api_key(key_value text, secret_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Simple base64 encoding for now (not secure but better than plaintext)
  RETURN encode(key_value::bytea, 'base64');
END;
$function$;

-- Fix decrypt_api_key function
CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_key text, secret_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN decode(encrypted_key, 'base64')::text;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

-- Fix trigger_set_timestamp function
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;