-- ============================================================
-- Remove Prospect PRO™ — drop de todas as tabelas, cron jobs e
-- limpeza de FKs externas / seed de módulo.
--
-- Contexto:
--   Após remoção do módulo do frontend e edge functions, esta migration
--   elimina a infraestrutura de banco do Prospect Pro de forma irreversível.
--
-- Pré-condições já atendidas por migrations anteriores:
--   - prospect_contacts dropada em 20260422000400
--   - prospect_establishments + prospect_people_legacy dropadas em 20260422000600
--   - cron job prospect-lgpd-auto-delete unscheduled em 20260422000600
--   - prospect_people_v2 renomeada para prospect_people em 20260422000500
--
-- Tabelas alvo deste drop:
--   prospect_audit_log
--   prospect_enrichment_results       (FK → prospect_people, prospect_enrichment_plugins)
--   prospect_people                   (FK → prospect_companies, prospect_campaigns)
--   prospect_companies                (FK → prospect_campaigns)
--   prospect_enrichment_plugins
--   prospect_opt_out_registry
--   prospect_campaigns                (root)
--
-- FK externa crítica:
--   clients_people.prospect_campaign_id → prospect_campaigns(id) ON DELETE SET NULL
--   Adicionada em 20260312180000 linha 253. Não cascateia em DROP TABLE,
--   precisa ser removida explicitamente. A coluna é dropada também porque
--   perde semântica sem o módulo Prospect.
--
-- Cron jobs vivos:
--   prospect-stuck-recovery (criado em 20260422000900) — unscheduled aqui.
--   Loop adicional ILIKE '%prospect%' como cinto-e-suspensórios para casos
--   de jobs ad-hoc criados manualmente no Dashboard.
-- ============================================================

BEGIN;

-- 1. Unschedule TODOS os cron jobs com 'prospect' no nome (defensivo)
DO $$
DECLARE
  job_record RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR job_record IN
      SELECT jobname FROM cron.job WHERE jobname ILIKE '%prospect%'
    LOOP
      PERFORM cron.unschedule(job_record.jobname);
      RAISE NOTICE 'Unscheduled cron job: %', job_record.jobname;
    END LOOP;
  END IF;
END $$;

-- 2. Remover FK externa em clients_people antes do DROP de prospect_campaigns
ALTER TABLE public.clients_people
  DROP CONSTRAINT IF EXISTS clients_people_prospect_campaign_id_fkey;

-- 3. Dropar índice associado à coluna prospect_campaign_id em clients_people
DROP INDEX IF EXISTS public.clients_people_prospect_campaign_id_idx;

-- 4. Dropar a coluna clients_people.prospect_campaign_id
--    (perde semântica sem o módulo; mantê-la criaria órfãos)
ALTER TABLE public.clients_people
  DROP COLUMN IF EXISTS prospect_campaign_id;

-- 5. Dropar tabelas Prospect em ordem topológica (folhas primeiro)
--    CASCADE cobre views/triggers eventuais; FKs entre prospect_* já
--    são respeitadas pela ordem.
DROP TABLE IF EXISTS public.prospect_audit_log           CASCADE;
DROP TABLE IF EXISTS public.prospect_enrichment_results  CASCADE;
DROP TABLE IF EXISTS public.prospect_people              CASCADE;
DROP TABLE IF EXISTS public.prospect_companies           CASCADE;
DROP TABLE IF EXISTS public.prospect_enrichment_plugins  CASCADE;
DROP TABLE IF EXISTS public.prospect_opt_out_registry    CASCADE;
DROP TABLE IF EXISTS public.prospect_campaigns           CASCADE;

-- Tabelas já dropadas em migrations anteriores (idempotente):
DROP TABLE IF EXISTS public.prospect_contacts            CASCADE;
DROP TABLE IF EXISTS public.prospect_establishments      CASCADE;
DROP TABLE IF EXISTS public.prospect_people_legacy       CASCADE;
DROP TABLE IF EXISTS public.prospect_people_v2           CASCADE;

-- 6. Remover seed do módulo prospect
DELETE FROM public.settings_system_modules
  WHERE module_key = 'prospect';

COMMIT;
