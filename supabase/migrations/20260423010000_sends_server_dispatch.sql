-- =============================================================================
-- FIX-SENDS-01: Server-side dispatch loop for SENDS PRO
-- Adds last_batch_at to sends + pg_cron job calling sends-dispatch-batch
-- =============================================================================

-- ── 1. Add last_batch_at column to sends ─────────────────────────────────────
-- Tracks when the last batch was dispatched; used by sends-dispatch-batch
-- to enforce send_interval_seconds cadence without browser involvement.
ALTER TABLE public.sends
  ADD COLUMN IF NOT EXISTS last_batch_at timestamptz;

COMMENT ON COLUMN public.sends.last_batch_at IS
  'Timestamp of last batch dispatch. Used by sends-dispatch-batch (pg_cron) '
  'to enforce send_interval_seconds cadence server-side.';

-- ── 2. Create dispatch scheduler function ────────────────────────────────────
-- Called by pg_cron every minute; invokes sends-dispatch-batch edge fn.
-- Edge fn handles per-send cadence logic (last_batch_at + interval check).
CREATE OR REPLACE FUNCTION public.trigger_sends_dispatch_batch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR supabase_url = '' OR svc_key IS NULL OR svc_key = '' THEN
    RAISE NOTICE 'trigger_sends_dispatch_batch: _app_config missing supabase_url or service_role_key. '
                 'Run: INSERT INTO _app_config VALUES (''supabase_url'', ''https://xxx.supabase.co''), '
                 '(''service_role_key'', ''...'') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;';
    RETURN;
  END IF;

  -- Only fire if there are running sends to process (skip wasted HTTP call)
  IF NOT EXISTS (SELECT 1 FROM public.sends WHERE status = 'running' LIMIT 1) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/sends-dispatch-batch',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := jsonb_build_object('source', 'pg_cron')
  );
END;
$$;

COMMENT ON FUNCTION public.trigger_sends_dispatch_batch() IS
  'Called by pg_cron every minute. Fires sends-dispatch-batch edge fn only when '
  'there are running sends. Requires _app_config to have supabase_url and service_role_key.';

-- ── 3. Register pg_cron job ───────────────────────────────────────────────────
-- cron.schedule() is idempotent — safe to re-run on migration retry.
SELECT cron.schedule(
  'sends-dispatch-batch',
  '* * * * *',
  'SELECT public.trigger_sends_dispatch_batch()'
);
