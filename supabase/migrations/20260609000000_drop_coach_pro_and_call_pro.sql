-- ═══════════════════════════════════════════════════════════════════════════════════
-- Major Overhaul — Squad A: DROP Coach Pro™ e Call Pro™
-- Migration: 20260609000000_drop_coach_pro_and_call_pro
--
-- Plano de referência:
--   docs/smart-memory/ops/squad-a-removal-plan.md (secção 4)
--
-- ATENÇÃO OPERACIONAL:
--   * NÃO aplicar esta migration antes de squad-a-alpha-1, alpha-2 e beta
--     concluírem a limpeza do frontend e das edge functions. Schema dropado
--     com código vivo causa erro 500 em produção.
--   * Após apply: regenerar src/integrations/supabase/types.ts via
--     `supabase gen types typescript`.
--   * Sem rollback automático (decisão §8 do plano). Tirar dump antes do apply.
--   * As 15 migrations originais NÃO devem ser deletadas (§4.7) — fazem parte
--     do histórico irreversível.
--
-- Ordem de execução (igual a §4.6):
--   1. Sair das publicações de Realtime das tabelas alvo.
--   2. Limpar registo dos módulos (settings_system_modules) e enabled_modules
--      em adm_clients.
--   3. DROP VIEW (v_coaching_insights) — dependente de meeting_evaluations.
--   4. DROP TABLE CASCADE pelos dois módulos (ordem reversa de FK).
--   5. DROP FUNCTION (trigger fn de Call Pro AS queues + RPC get_call_stats).
-- ═══════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. REALTIME PUBLICATION
-- ──────────────────────────────────────────────────────────────────────────────
-- Retirar tabelas alvo da publicação supabase_realtime antes do DROP.
-- DROP TABLE com CASCADE remove a inscrição implicitamente, mas explicitar
-- aqui evita warnings e mantém a publicação consistente.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'call_pro_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.call_pro_calls;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'call_pro_as_queues'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.call_pro_as_queues;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'meeting_evaluations'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.meeting_evaluations;
  END IF;
END $$;


-- ──────────────────────────────────────────────────────────────────────────────
-- 2. REGISTO DE MÓDULOS
-- ──────────────────────────────────────────────────────────────────────────────

-- Remover entradas dos módulos coach (registado em 20260422000301) e call.
-- Call Pro nunca registou explicitamente uma linha mas mantemos o IN ('coach','call')
-- defensivamente: deletar nada por ausência é seguro.
DELETE FROM public.settings_system_modules
WHERE module_key IN ('coach', 'call');

-- Limpar 'coach' e 'call' do JSONB enabled_modules em adm_clients.
-- adm_clients.enabled_modules pode armazenar elementos como strings ('"coach"')
-- ou objectos. O filtro abaixo cobre apenas o caso de array de strings — se
-- houver linhas com formato diferente, este UPDATE não as toca (não causa
-- erro, mas pode requerer pós-tratamento manual). Decisão registada em §8.
UPDATE public.adm_clients
SET enabled_modules = COALESCE(
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(enabled_modules) AS elem
    WHERE elem NOT IN ('"coach"'::jsonb, '"call"'::jsonb)
  ),
  '[]'::jsonb
)
WHERE enabled_modules IS NOT NULL
  AND jsonb_typeof(enabled_modules) = 'array'
  AND (
        enabled_modules @> '["coach"]'::jsonb
     OR enabled_modules @> '["call"]'::jsonb
      );


-- ──────────────────────────────────────────────────────────────────────────────
-- 3. VIEWS
-- ──────────────────────────────────────────────────────────────────────────────

-- Coach BI view (CF-5.1). CASCADE para apanhar qualquer dependente externo
-- (e.g. a view fantasma `coach_meeting_evaluations` mencionada em §8 do plano,
-- caso exista apenas em produção).
DROP VIEW IF EXISTS public.v_coaching_insights CASCADE;


-- ──────────────────────────────────────────────────────────────────────────────
-- 4. TABELAS — COACH PRO
-- ──────────────────────────────────────────────────────────────────────────────
-- Ordem reversa de FK; CASCADE limpa policies, triggers, índices e FKs residuais.

DROP TABLE IF EXISTS public.evaluation_criteria_results    CASCADE;
DROP TABLE IF EXISTS public.evaluation_section_results     CASCADE;
DROP TABLE IF EXISTS public.coach_email_log                CASCADE;
DROP TABLE IF EXISTS public.meeting_evaluations            CASCADE;
DROP TABLE IF EXISTS public.meeting_playbook_assignments   CASCADE;
DROP TABLE IF EXISTS public.playbook_criteria              CASCADE;
DROP TABLE IF EXISTS public.playbook_sections              CASCADE;
DROP TABLE IF EXISTS public.playbooks                      CASCADE;
DROP TABLE IF EXISTS public.playbook_templates             CASCADE;
DROP TABLE IF EXISTS public.coach_ai_settings              CASCADE;


-- ──────────────────────────────────────────────────────────────────────────────
-- 5. TABELAS — CALL PRO
-- ──────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.call_pro_calls                 CASCADE;
DROP TABLE IF EXISTS public.call_pro_tabulation_categories CASCADE;
DROP TABLE IF EXISTS public.call_pro_operator_mappings     CASCADE;
DROP TABLE IF EXISTS public.call_pro_as_queues             CASCADE;
DROP TABLE IF EXISTS public.call_pro_settings              CASCADE;

-- Nota §4.1 do plano: não existe tabela call_pro_billing — a migration
-- 20260318900003_callpro_billing.sql apenas adiciona colunas (cost,
-- business_hours_call) a call_pro_calls, que caem com o DROP acima.


-- ──────────────────────────────────────────────────────────────────────────────
-- 6. FUNCTIONS / RPC
-- ──────────────────────────────────────────────────────────────────────────────

-- Trigger function de updated_at para call_pro_as_queues
-- (a tabela já foi dropada acima; CASCADE garante limpeza do trigger).
DROP FUNCTION IF EXISTS public.set_call_pro_as_queues_updated_at() CASCADE;

-- RPC consumido por useCallProBIStats no frontend.
-- A function declarada em 20260423017000 chama-se get_call_stats, não
-- call_pro_get_call_stats. Drop por ambas as assinaturas defensivamente.
DROP FUNCTION IF EXISTS public.get_call_stats(timestamptz, timestamptz)        CASCADE;
DROP FUNCTION IF EXISTS public.call_pro_get_call_stats(timestamptz, timestamptz) CASCADE;

COMMIT;
