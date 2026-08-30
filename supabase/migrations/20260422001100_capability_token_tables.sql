-- Capability Token Tables — Schedule PRO™
-- ADR-SP-01: booking_token_jti_usage — denylist for revoked booking tokens
-- ADR-SP-02: action_token_consumed   — single-use enforcement for edge action tokens

BEGIN;

-- ── 1. booking_token_jti_usage (ADR-SP-01) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.booking_token_jti_usage (
  jti        text        PRIMARY KEY,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  reason     text
);

CREATE INDEX IF NOT EXISTS idx_booking_token_jti_revoked_at
  ON public.booking_token_jti_usage (revoked_at);

COMMENT ON TABLE public.booking_token_jti_usage IS
  'ADR-SP-01: Denylist of revoked booking JWT tokens (opt-in revocation). Checked on every public-booking request. GC cron purges entries older than token TTL.';

ALTER TABLE public.booking_token_jti_usage ENABLE ROW LEVEL SECURITY;

-- Only service_role can write; no authenticated read (checked in SECURITY DEFINER functions only)
DROP POLICY IF EXISTS "booking_jti_service_role_only" ON public.booking_token_jti_usage;
CREATE POLICY "booking_jti_service_role_only"
  ON public.booking_token_jti_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 2. action_token_consumed (ADR-SP-02) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.action_token_consumed (
  jti         text        PRIMARY KEY,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  action      text,
  meeting_id  text
);

CREATE INDEX IF NOT EXISTS idx_action_token_consumed_at
  ON public.action_token_consumed (consumed_at);

COMMENT ON TABLE public.action_token_consumed IS
  $$ADR-SP-02: Single-use enforcement for edge action tokens (confirm, cancel, reschedule). INSERT on first use, duplicate jti = token already consumed. GC cron purges expired entries.$$;

ALTER TABLE public.action_token_consumed ENABLE ROW LEVEL SECURITY;

-- Only service_role can write; no authenticated read (checked in SECURITY DEFINER functions only)
DROP POLICY IF EXISTS "action_token_service_role_only" ON public.action_token_consumed;
CREATE POLICY "action_token_service_role_only"
  ON public.action_token_consumed
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
