-- ROLLBACK: FWUP-09
-- ATENÇÃO: tabelas dropadas NÃO podem ser restauradas com dados.
-- Este rollback recria estruturas vazias apenas para compatibilidade de schema.
-- Dados perdidos são irrecuperáveis (tabelas confirmadas mortas — sem dados funcionais).

BEGIN;

-- Recriar phantom fields (estrutura apenas — sem dados)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS followup_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followup_status text;

-- Recriar tabelas vazias (estrutura mínima)
CREATE TABLE IF NOT EXISTS public.crm_pipelines (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.crm_stages (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.crm_stage_followups (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.crm_agendamentos_followups (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.clients_meetings_followups (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.crm_campos_personalizados (id uuid PRIMARY KEY DEFAULT gen_random_uuid());

RAISE NOTICE 'FWUP-09 ROLLBACK — estruturas restauradas sem dados.';

COMMIT;
