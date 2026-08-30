-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  QA Fix: BUG-1 + SEC-1 from Omni Pro QA gate review                    ║
-- ║                                                                          ║
-- ║  BUG-1 (HIGH): reset_stale_sending_messages used created_at instead of  ║
-- ║  updated_at — messages created >5min ago were reset immediately after   ║
-- ║  being claimed, causing infinite claim→reset loop and potential dupes.  ║
-- ║                                                                          ║
-- ║  SEC-1 (MEDIUM): claim_pending_messages and reset_stale_sending_messages║
-- ║  were callable by anon/authenticated via PostgREST. Now restricted to   ║
-- ║  service_role only.                                                      ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- ── 1. FIX BUG-1: Use updated_at instead of created_at ─────────────────────
-- The messages table has a BEFORE UPDATE trigger that sets updated_at = now()
-- automatically. When claim_pending_messages sets status='sending', updated_at
-- is refreshed. So we filter on updated_at to detect truly stale claims.

CREATE OR REPLACE FUNCTION reset_stale_sending_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE messages
  SET status = 'pending'
  WHERE status = 'sending'
    AND updated_at < now() - interval '5 minutes';
END;
$$;

-- ── 2. FIX SEC-1: Restrict RPC access to service_role only ──────────────────
-- These functions should only be called by edge functions (service_role key)
-- and pg_cron (runs as superuser). Never by anon or authenticated clients.

REVOKE ALL ON FUNCTION claim_pending_messages(int, int, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_pending_messages(int, int, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION reset_stale_sending_messages() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_stale_sending_messages() TO service_role;
