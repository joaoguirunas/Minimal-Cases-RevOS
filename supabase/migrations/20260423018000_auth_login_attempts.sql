-- auth_login_attempts: server-side rate limit tracking for login
-- ip_hash and email_hash store SHA-256 hex digests to avoid PII storage
CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash       text NOT NULL,
  email_hash    text NOT NULL,
  tenant_id     uuid REFERENCES public.settings(id) ON DELETE CASCADE,
  attempts      integer NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  last_attempt  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ip_hash, email_hash)
);

CREATE INDEX IF NOT EXISTS auth_login_attempts_lookup_idx
  ON public.auth_login_attempts (ip_hash, email_hash);

CREATE INDEX IF NOT EXISTS auth_login_attempts_blocked_until_idx
  ON public.auth_login_attempts (blocked_until)
  WHERE blocked_until IS NOT NULL;

-- RLS: only service_role can read/write (edge fn uses service role key)
ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;

-- pg_cron cleanup: remove expired blocks every hour
CREATE OR REPLACE FUNCTION public.cleanup_auth_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.auth_login_attempts
  WHERE blocked_until IS NOT NULL
    AND blocked_until < now() - interval '1 hour';
END;
$$;

SELECT cron.schedule(
  'cleanup-auth-login-attempts',
  '0 * * * *',
  $$SELECT public.cleanup_auth_login_attempts()$$
);
