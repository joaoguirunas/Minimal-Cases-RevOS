-- AUTH-V2-10: Auth events audit log

CREATE TABLE IF NOT EXISTS public.auth_events_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        REFERENCES public.crm_tenants(id) ON DELETE CASCADE,
  user_id       uuid,
  event_type    text        NOT NULL,
  ip_hash       text,
  user_agent_hash text,
  metadata      jsonb       DEFAULT '{}',
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_log_tenant ON public.auth_events_log(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_log_user   ON public.auth_events_log(user_id, occurred_at DESC);

ALTER TABLE public.auth_events_log ENABLE ROW LEVEL SECURITY;

-- Tenants can read their own events; insert is done client-side via anon key with app.current_tenant_id
DROP POLICY IF EXISTS auth_events_select ON public.auth_events_log;
CREATE POLICY auth_events_select ON public.auth_events_log
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR public.user_has_tenant_access(tenant_id)
    OR (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
  );

DROP POLICY IF EXISTS auth_events_insert ON public.auth_events_log;
CREATE POLICY auth_events_insert ON public.auth_events_log
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

-- pg_cron: purge after 90 days
SELECT cron.schedule(
  'auth-events-log-gc',
  '0 5 * * *',
  $$DELETE FROM public.auth_events_log WHERE occurred_at < now() - interval '90 days'$$
);
