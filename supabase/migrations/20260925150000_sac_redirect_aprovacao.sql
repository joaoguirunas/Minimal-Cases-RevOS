-- SAC · primeiras respostas passam por aprovação antes de sair.
-- Enquanto settings.sac_redirect_approval_remaining > 0, o agente só PROPÕE a
-- resposta (status awaiting_approval); cada aprovação/rejeição desconta 1.
ALTER TABLE public.sac_redirects
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS proposed_text text,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_note text;
ALTER TABLE public.sac_redirects DROP CONSTRAINT IF EXISTS sac_redirects_status_check;
ALTER TABLE public.sac_redirects ADD CONSTRAINT sac_redirects_status_check
  CHECK (status IS NULL OR status IN ('awaiting_approval','approved','rejected','sent','failed','expired'));
CREATE INDEX IF NOT EXISTS idx_sac_redirects_awaiting ON public.sac_redirects (created_at) WHERE status = 'awaiting_approval';

UPDATE public.omni_channel_configs
   SET settings = coalesce(settings, '{}'::jsonb) || '{"sac_redirect_approval_remaining": 20}'::jsonb
 WHERE channel = 'whatsapp';

-- desconta 1 da fila de aprovação (sem ficar negativo) e devolve quanto sobrou
CREATE OR REPLACE FUNCTION public.sac_approval_consume() RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  UPDATE public.omni_channel_configs
     SET settings = settings || jsonb_build_object('sac_redirect_approval_remaining',
         greatest(coalesce((settings->>'sac_redirect_approval_remaining')::int, 0) - 1, 0))
   WHERE channel = 'whatsapp'
  RETURNING (settings->>'sac_redirect_approval_remaining')::int $$;
REVOKE EXECUTE ON FUNCTION public.sac_approval_consume() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sac_approval_consume() TO service_role;
