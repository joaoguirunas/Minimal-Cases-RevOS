-- bi_voice_token_log: rate limit tracking for gemini-live-token edge fn
-- Stores issued ephemeral tokens per tenant for abuse detection (max 20/hour/tenant)
CREATE TABLE IF NOT EXISTS public.bi_voice_token_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.settings(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  model_id   text NOT NULL
);

CREATE INDEX IF NOT EXISTS bi_voice_token_log_tenant_issued_idx
  ON public.bi_voice_token_log (tenant_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS bi_voice_token_log_cleanup_idx
  ON public.bi_voice_token_log (issued_at);

-- RLS: service_role only (edge fn uses service role key)
ALTER TABLE public.bi_voice_token_log ENABLE ROW LEVEL SECURITY;

-- pg_cron cleanup: keep 24h of history, run daily
CREATE OR REPLACE FUNCTION public.cleanup_bi_voice_token_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.bi_voice_token_log
  WHERE issued_at < now() - interval '24 hours';
END;
$$;

SELECT cron.schedule(
  'cleanup-bi-voice-token-log',
  '0 3 * * *',
  $$SELECT public.cleanup_bi_voice_token_log()$$
);
