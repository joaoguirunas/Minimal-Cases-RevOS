-- SECURITY FIX Part 1: Secure crm_pessoas and crm_usuarios tables
-- Break migration into smaller parts to avoid deadlocks

-- 1. SECURE crm_pessoas table (currently publicly readable)
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