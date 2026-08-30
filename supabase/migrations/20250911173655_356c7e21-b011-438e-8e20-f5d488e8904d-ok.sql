-- CRITICAL SECURITY FIX: Clean up duplicate and insecure crm_pipelines policies
-- Remove all existing policies and create only secure ones

-- 1. Drop ALL existing policies on crm_pipelines (including insecure ones)
DROP POLICY IF EXISTS "Users can create pipelines for their tenant" ON public.crm_pipelines;
DROP POLICY IF EXISTS "Users can delete pipelines for their tenant" ON public.crm_pipelines;
DROP POLICY IF EXISTS "Users can delete pipelines from their tenant" ON public.crm_pipelines;
DROP POLICY IF EXISTS "Users can insert pipelines in their tenant" ON public.crm_pipelines;
DROP POLICY IF EXISTS "Users can update pipelines for their tenant" ON public.crm_pipelines;
DROP POLICY IF EXISTS "Users can update pipelines from their tenant" ON public.crm_pipelines;
DROP POLICY IF EXISTS "Users can view pipelines for their tenant" ON public.crm_pipelines;
DROP POLICY IF EXISTS "Users can view pipelines from their tenant" ON public.crm_pipelines;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_pipelines;

-- 2. Create ONLY secure policies for crm_pipelines
CREATE POLICY "Secure: Users can view pipelines from their tenant"
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

CREATE POLICY "Secure: Users can insert pipelines in their tenant"
ON public.crm_pipelines
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pipelines.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

CREATE POLICY "Secure: Users can update pipelines from their tenant"
ON public.crm_pipelines
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_pipelines.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

CREATE POLICY "Secure: Users can delete pipelines from their tenant"
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

-- 3. Do the same cleanup for crm_stages to ensure consistency
DROP POLICY IF EXISTS "Users can create stages for their tenant" ON public.crm_stages;
DROP POLICY IF EXISTS "Users can delete stages for their tenant" ON public.crm_stages;
DROP POLICY IF EXISTS "Users can delete stages from their tenant" ON public.crm_stages;
DROP POLICY IF EXISTS "Users can insert stages in their tenant" ON public.crm_stages;
DROP POLICY IF EXISTS "Users can update stages for their tenant" ON public.crm_stages;
DROP POLICY IF EXISTS "Users can update stages from their tenant" ON public.crm_stages;
DROP POLICY IF EXISTS "Users can view stages for their tenant" ON public.crm_stages;
DROP POLICY IF EXISTS "Users can view stages from their tenant" ON public.crm_stages;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_stages;

-- Create ONLY secure policies for crm_stages
CREATE POLICY "Secure: Users can view stages from their tenant"
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

CREATE POLICY "Secure: Users can insert stages in their tenant"
ON public.crm_stages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_stages.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

CREATE POLICY "Secure: Users can update stages from their tenant"
ON public.crm_stages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND (u.tenant_id = crm_stages.tenant_id OR u.super_adm = true)
    AND u.ativo = true
    AND (u.gestor = true OR u.super_adm = true)
  )
);

CREATE POLICY "Secure: Users can delete stages from their tenant"
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