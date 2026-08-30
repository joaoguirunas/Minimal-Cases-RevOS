-- ═══════════════════════════════════════════════════════════════════
-- 20260502140000_leads_add_origem_lista.sql
-- Brief: Adiciona coluna origem_lista text nullable à tabela leads
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS origem_lista text;

COMMENT ON COLUMN public.leads.origem_lista IS 'Lista ou campanha de origem do lead';

COMMIT;
