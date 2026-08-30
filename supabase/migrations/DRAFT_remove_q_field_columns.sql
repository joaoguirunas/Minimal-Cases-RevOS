-- DRAFT: Remover colunas q1-q26 hardcoded da tabela clients_people
-- Status: RASCUNHO — NÃO APLICAR sem aprovação do lead (team-os)
-- Contexto: FieldMapper/ImportListaTab usava q1-q26 como labels hardcoded.
--   Qualificação de LEADS já é dinâmica via lead_field_definitions + lead_field_values (desde 2026-02-19).
--   As colunas q1-q26 abaixo são campos de DIAGNÓSTICO e QUALIFICAÇÃO do CONTATO (clients_people),
--   usadas pelo agente IA (save_agent_complete_rpc). Remover SOMENTE após confirmar que:
--   a) Nenhuma edge function ainda lê/escreve estas colunas (ver ai_agents_steps e save_agent_complete_rpc)
--   b) Dados históricos foram migrados ou são dispensáveis
--   c) Frontend não referencia clients_people.q* diretamente

-- Rollback disponível: readicionar as colunas com ADD COLUMN IF NOT EXISTS (dados serão perdidos)

-- =============================================================================
-- SEÇÃO COMENTADA — remover comentários para executar
-- =============================================================================

/*
BEGIN;

-- DIAGNÓSTICO (q1-q8) — removidos de clients_people
ALTER TABLE public.clients_people
  DROP COLUMN IF EXISTS q1_main_bottleneck,
  DROP COLUMN IF EXISTS q2_lead_volume_month,
  DROP COLUMN IF EXISTS q3_team_size,
  DROP COLUMN IF EXISTS q4_crm_maturity,
  DROP COLUMN IF EXISTS q5_crm_name,
  DROP COLUMN IF EXISTS q6_trigger,
  DROP COLUMN IF EXISTS q7_problem_impact,
  DROP COLUMN IF EXISTS q8_engagement_level;

-- QUALIFICAÇÃO (q9-q20) — removidos de clients_people
ALTER TABLE public.clients_people
  DROP COLUMN IF EXISTS q9_decision_authority,
  DROP COLUMN IF EXISTS q10_stakeholders,
  DROP COLUMN IF EXISTS q11_budget_approved,
  DROP COLUMN IF EXISTS q12_timeline,
  DROP COLUMN IF EXISTS q13_urgency_reason,
  DROP COLUMN IF EXISTS q14_data_ready,
  DROP COLUMN IF EXISTS q15_minimum_volume,
  DROP COLUMN IF EXISTS q16_expected_roi,
  DROP COLUMN IF EXISTS q17_objections,
  DROP COLUMN IF EXISTS q18_real_fit,
  DROP COLUMN IF EXISTS q19_qualification_status,
  DROP COLUMN IF EXISTS q20_rejection_reason;

-- CONTEXTO GLOBAL (q21-q24)
ALTER TABLE public.clients_people
  DROP COLUMN IF EXISTS q21_interest_level,
  DROP COLUMN IF EXISTS q22_close_probability,
  DROP COLUMN IF EXISTS q23_behavioral_tags,
  DROP COLUMN IF EXISTS q24_last_update_by_agent;

-- DISC (q25-q26)
ALTER TABLE public.clients_people
  DROP COLUMN IF EXISTS q25_disc_profile,
  DROP COLUMN IF EXISTS q26_disc_analysis;

COMMIT;
*/

-- =============================================================================
-- ROLLBACK (caso precise restaurar):
-- =============================================================================

/*
BEGIN;

ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q1_main_bottleneck TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q2_lead_volume_month INTEGER;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q3_team_size INTEGER;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q4_crm_maturity TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q5_crm_name TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q6_trigger TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q7_problem_impact TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q8_engagement_level TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q9_decision_authority TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q10_stakeholders TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q11_budget_approved TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q12_timeline TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q13_urgency_reason TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q14_data_ready TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q15_minimum_volume TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q16_expected_roi TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q17_objections TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q18_real_fit TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q19_qualification_status TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q20_rejection_reason TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q21_interest_level INTEGER;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q22_close_probability INTEGER;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q23_behavioral_tags TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q24_last_update_by_agent TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q25_disc_profile TEXT;
ALTER TABLE public.clients_people ADD COLUMN IF NOT EXISTS q26_disc_analysis TEXT;

COMMIT;
*/
