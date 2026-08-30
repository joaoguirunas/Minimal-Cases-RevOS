-- US-CFG-04: tenant_api_keys table + pg_cron cleanup + api-key-auth edge function support

CREATE TABLE IF NOT EXISTS public.tenant_api_keys (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.crm_tenants(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  key_hash      text        NOT NULL,
  key_prefix    varchar(12) NOT NULL,
  created_by    uuid        REFERENCES public.settings_users(id) ON DELETE SET NULL,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant_id ON public.tenant_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_key_hash   ON public.tenant_api_keys(key_hash);

-- RLS: tenant can only see/manage their own keys
ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_api_keys_select ON public.tenant_api_keys;
CREATE POLICY tenant_api_keys_select ON public.tenant_api_keys
  FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS tenant_api_keys_insert ON public.tenant_api_keys;
CREATE POLICY tenant_api_keys_insert ON public.tenant_api_keys
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_user_tenant_id());

DROP POLICY IF EXISTS tenant_api_keys_update ON public.tenant_api_keys;
CREATE POLICY tenant_api_keys_update ON public.tenant_api_keys
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_current_user_tenant_id())
  WITH CHECK (tenant_id = public.get_current_user_tenant_id());

DROP POLICY IF EXISTS tenant_api_keys_delete ON public.tenant_api_keys;
CREATE POLICY tenant_api_keys_delete ON public.tenant_api_keys
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_current_user_tenant_id());

-- GC: delete revoked keys older than 30 days
SELECT cron.schedule(
  'tenant-api-keys-gc',
  '0 4 * * *',
  $$DELETE FROM public.tenant_api_keys WHERE revoked_at IS NOT NULL AND revoked_at < now() - interval '30 days'$$
);
