-- Secret Access Log — ADR-SP-05
-- Append-only audit trail for Vault secret access.
-- Retention: 90 days — GC cron deletes WHERE accessed_at < now() - interval '90 days'.

BEGIN;

CREATE TABLE IF NOT EXISTS public.secret_access_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_name    text        NOT NULL,
  caller_context text,
  accessed_at    timestamptz NOT NULL DEFAULT now(),
  ip_address     inet
);

CREATE INDEX IF NOT EXISTS idx_secret_access_log_accessed_at
  ON public.secret_access_log (accessed_at);

COMMENT ON TABLE public.secret_access_log IS
  'ADR-SP-05: Append-only audit trail for Vault secret access. '
  'Each row records which secret was read and by which function/edge context. '
  'Retention 90 days — GC cron purges entries where accessed_at < now() - interval ''90 days''.';

ALTER TABLE public.secret_access_log ENABLE ROW LEVEL SECURITY;

-- INSERT only — service_role appends audit entries; no UPDATE or DELETE allowed via RLS
DROP POLICY IF EXISTS "secret_access_log_insert" ON public.secret_access_log;
CREATE POLICY "secret_access_log_insert"
  ON public.secret_access_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMIT;
