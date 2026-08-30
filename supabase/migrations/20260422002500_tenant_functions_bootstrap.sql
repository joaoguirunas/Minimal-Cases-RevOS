-- Bootstrap: ensure user_has_tenant_access and is_admin_or_gestor exist
-- These functions were originally created in pre-manifest migrations (-ok.sql)
-- and may be absent in tenants provisioned before the manifest system.
-- Using CREATE OR REPLACE — idempotent.
-- Note: user_has_tenant_access uses crm_tenants (exists in all tenants).
--       Falls back to false if tenant cannot be resolved (safe default).

CREATE OR REPLACE FUNCTION public.user_has_tenant_access(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_tenants
    WHERE id = target_tenant_id
      AND (
        -- Check if current user is associated via settings_users
        EXISTS (
          SELECT 1 FROM public.settings_users
          WHERE auth_user_id = auth.uid()
            AND active = true
        )
        -- Super admin emails (fallback)
        OR auth.email() IN ('joao@growthsales.ai', 'rafaela@iatize.com', 'joao@iatize.com')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type = 'gestor')
      AND active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_gestor()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT public.is_admin_or_manager()
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
$$;
