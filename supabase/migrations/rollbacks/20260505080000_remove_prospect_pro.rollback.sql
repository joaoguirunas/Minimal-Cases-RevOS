-- ============================================================
-- ROLLBACK — Remove Prospect PRO™
--
-- ATENÇÃO: rollback é parcial e best-effort. Os dados em
-- prospect_* foram permanentemente perdidos no DROP CASCADE.
-- Este rollback apenas restaura o esquema vazio para que o
-- módulo possa ser re-implantado do zero, se necessário.
--
-- Recomenda-se NÃO executar este rollback. A forma correta de
-- "voltar atrás" é restaurar de um pg_dump anterior à 20260505080000.
-- ============================================================

BEGIN;

-- 1. Re-criar tabela prospect_campaigns (root)
CREATE TABLE IF NOT EXISTS public.prospect_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  name            text NOT NULL,
  status          text NOT NULL DEFAULT 'draft',
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. Re-adicionar coluna FK em clients_people
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS prospect_campaign_id uuid;

ALTER TABLE public.clients_people
  ADD CONSTRAINT clients_people_prospect_campaign_id_fkey
    FOREIGN KEY (prospect_campaign_id)
    REFERENCES public.prospect_campaigns(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_people_prospect_campaign_id_idx
  ON public.clients_people(prospect_campaign_id)
  WHERE prospect_campaign_id IS NOT NULL;

-- 3. Re-seed do módulo prospect
INSERT INTO public.settings_system_modules (module_key, module_name, is_active, order_index, icon)
VALUES ('prospect', 'PROSPECT PRO™', true, 9, 'Search')
ON CONFLICT (module_key) DO NOTHING;

-- NOTA: tabelas prospect_audit_log, prospect_companies, prospect_people,
-- prospect_enrichment_plugins, prospect_enrichment_results e
-- prospect_opt_out_registry NÃO são recriadas neste rollback —
-- requer re-executar manualmente as migrations originais
-- (20260312180000, 20260315195000, 20260318200000) caso necessário.

COMMIT;
