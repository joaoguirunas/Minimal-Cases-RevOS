-- ═══════════════════════════════════════════════════════════════════
-- 20260502130000_leads_add_indicacao_evento_fields.sql
-- Brief: Adiciona 4 campos nullable text à tabela leads:
--   recomendante, relacao_recomendante, relacao_corretor, nome_evento
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS recomendante         text,
  ADD COLUMN IF NOT EXISTS relacao_recomendante text,
  ADD COLUMN IF NOT EXISTS relacao_corretor     text,
  ADD COLUMN IF NOT EXISTS nome_evento          text;

COMMENT ON COLUMN public.leads.recomendante         IS 'Nome de quem indicou o lead';
COMMENT ON COLUMN public.leads.relacao_recomendante IS 'Relação do lead com o recomendante';
COMMENT ON COLUMN public.leads.relacao_corretor     IS 'Relação do lead com o corretor';
COMMENT ON COLUMN public.leads.nome_evento          IS 'Nome do evento de origem do lead';

COMMIT;
