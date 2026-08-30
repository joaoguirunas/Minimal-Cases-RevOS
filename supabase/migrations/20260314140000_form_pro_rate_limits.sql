-- FP-05: Persistent rate limit table for lp-submit Edge Function
-- Replaces in-memory Map that resets on cold starts

CREATE TABLE IF NOT EXISTS public.form_pro_rate_limits (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip   TEXT NOT NULL,
  ts   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_pro_rate_limits_ip_ts
  ON public.form_pro_rate_limits (ip, ts DESC);

-- RLS: only service_role can read/write (edge function uses service_role key)
ALTER TABLE public.form_pro_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON public.form_pro_rate_limits;
CREATE POLICY "service_role_only"
  ON public.form_pro_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
