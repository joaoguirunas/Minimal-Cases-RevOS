-- BI-VOICE-04: bi_voice_session_log
-- Telemetria de sessões Gemini Live por tenant para cost monitoring futuro (BI-VOICE-05).
-- Cada sessão grava started_at no início e ended_at + tokens no fim (fire-and-forget do client).

CREATE TABLE IF NOT EXISTS public.bi_voice_session_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES public.settings(id) ON DELETE CASCADE,
  user_id          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  duration_seconds integer,
  total_tokens_in  bigint,
  total_tokens_out bigint,
  error_msg        text
);

-- Index para dashboard de cost futuro
CREATE INDEX IF NOT EXISTS bi_voice_session_log_tenant_started_idx
  ON public.bi_voice_session_log (tenant_id, started_at DESC);

-- RLS
ALTER TABLE public.bi_voice_session_log ENABLE ROW LEVEL SECURITY;

-- Usuário autenticado lê e insere sessões do próprio tenant
DROP POLICY IF EXISTS "bi_voice_session_log_tenant_select" ON public.bi_voice_session_log;
CREATE POLICY "bi_voice_session_log_tenant_select"
  ON public.bi_voice_session_log
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.settings LIMIT 1)
  );

DROP POLICY IF EXISTS "bi_voice_session_log_tenant_insert" ON public.bi_voice_session_log;
CREATE POLICY "bi_voice_session_log_tenant_insert"
  ON public.bi_voice_session_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.settings LIMIT 1)
  );

-- Usuário faz patch apenas nos próprios registros (ended_at, tokens, error_msg)
DROP POLICY IF EXISTS "bi_voice_session_log_own_update" ON public.bi_voice_session_log;
CREATE POLICY "bi_voice_session_log_own_update"
  ON public.bi_voice_session_log
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
