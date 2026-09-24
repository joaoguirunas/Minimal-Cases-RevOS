-- SAC · direcionamento automático para o número de atendimento.
-- Toda decisão do agente (redirecionou ou não, e por quê) fica registrada.
CREATE TABLE IF NOT EXISTS public.sac_redirects (
  id          bigserial PRIMARY KEY,
  people_id   uuid NOT NULL REFERENCES public.clients_people(id) ON DELETE CASCADE,
  run_bucket  bigint NOT NULL,              -- minuto da execução: trava contra rajada (várias mensagens seguidas)
  messages    text[] NOT NULL DEFAULT '{}',
  intent      text,
  confidence  numeric,
  redirected  boolean NOT NULL DEFAULT false,
  reason      text,
  dry_run     boolean NOT NULL DEFAULT false,
  message_id  bigint,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (people_id, run_bucket)
);
CREATE INDEX IF NOT EXISTS idx_sac_redirects_people ON public.sac_redirects (people_id, created_at DESC);
ALTER TABLE public.sac_redirects ENABLE ROW LEVEL SECURITY;
CREATE POLICY sac_redirects_staff ON public.sac_redirects FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active) AND NOT (SELECT public.is_commercial()));
CREATE POLICY sac_redirects_service ON public.sac_redirects FOR ALL USING (auth.role() = 'service_role');

-- Desligado até o go.
UPDATE public.omni_channel_configs SET settings = coalesce(settings,'{}'::jsonb) || '{"sac_redirect_enabled": false}'::jsonb WHERE channel = 'whatsapp';
