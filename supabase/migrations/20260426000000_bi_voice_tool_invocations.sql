-- BI-VOICE-03: bi_voice_tool_invocations
-- Telemetria fire-and-forget de chamadas de tools do BI Voice (Gemini Live function calling).
-- Dados de auditoria e latência por tenant; limpos automaticamente após 30 dias.

CREATE TABLE IF NOT EXISTS public.bi_voice_tool_invocations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        REFERENCES public.settings(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  tool_name     text        NOT NULL,
  args          jsonb,
  latency_ms    integer,
  success       boolean     NOT NULL DEFAULT true,
  error_message text,
  called_at     timestamptz NOT NULL DEFAULT now()
);

-- Índice principal: telemetria por tenant cronológica
CREATE INDEX IF NOT EXISTS bi_voice_tool_invocations_tenant_called_idx
  ON public.bi_voice_tool_invocations (tenant_id, called_at DESC);

-- Índice secundário: análise por tool ao longo do tempo
CREATE INDEX IF NOT EXISTS bi_voice_tool_invocations_tool_called_idx
  ON public.bi_voice_tool_invocations (tool_name, called_at DESC);

-- RLS
ALTER TABLE public.bi_voice_tool_invocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bi_voice_tool_invocations_tenant_select" ON public.bi_voice_tool_invocations;
CREATE POLICY "bi_voice_tool_invocations_tenant_select"
  ON public.bi_voice_tool_invocations
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.settings LIMIT 1)
  );

DROP POLICY IF EXISTS "bi_voice_tool_invocations_tenant_insert" ON public.bi_voice_tool_invocations;
CREATE POLICY "bi_voice_tool_invocations_tenant_insert"
  ON public.bi_voice_tool_invocations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.settings LIMIT 1)
  );

-- pg_cron: purge de registros com mais de 30 dias (diário às 03h UTC)
SELECT cron.schedule(
  'bi_voice_tool_invocations_cleanup',
  '0 3 * * *',
  $$DELETE FROM public.bi_voice_tool_invocations WHERE called_at < now() - interval '30 days'$$
);
