-- FWUP-12: Baseline repair for new tenants (ORA and future)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROBLEMA:
--   Migration 009 (ensure_full_tenant_baseline) já estava marcada como 'success'
--   em tenants novos (ex: ORA) ANTES de adicionarmos os blocos R8/R9/R10 ao
--   REPAIR section. Por isso, esses blocos NUNCA rodaram nesses tenants.
--
--   Consequência: 13 migrations falham por colunas/funções ausentes:
--     039/045/046/063 — ai_agents.template_type
--     044             — find_duplicate_person()
--     062             — settings_whatsapp_channels.meta_template_name
--     075             — lead_field_definitions.agent_managed
--     081             — ai_agents.llm_model
--     085/087         — meetings.lead_id (alias m.lead_id nas queries)
--     117/146         — meetings.user_id (alias m.user_id nas queries)
--
-- WHAT THIS DOES:
--   1. Adiciona colunas ausentes em ai_agents, lead_field_definitions,
--      settings_whatsapp_channels
--   2. Cria/substitui find_duplicate_person()
--   3. Renomeia colunas P6 em todas as tabelas afetadas (com IF EXISTS guards)
--
-- IDEMPOTENTE: seguro para rodar em qualquer tenant.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. ai_agents: colunas ausentes de migrations pré-época ───────────────────
-- template_type: 20260223000000_phase_consolidation (section 7.6)
-- llm_model:     20260302100000_n8n-waa-1-ai-agents-llm-config
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS template_type text,
  ADD COLUMN IF NOT EXISTS llm_model     text NOT NULL DEFAULT 'gpt-4o-mini';

-- ── 2. lead_field_definitions.agent_managed (20260224001000) ─────────────────
ALTER TABLE public.lead_field_definitions
  ADD COLUMN IF NOT EXISTS agent_managed boolean NOT NULL DEFAULT false;

-- ── 3. settings_whatsapp_channels.meta_template_name (20260305) ──────────────
ALTER TABLE public.settings_whatsapp_channels
  ADD COLUMN IF NOT EXISTS meta_template_name text;

-- ── 4. find_duplicate_person (20260306000000_omni_identity_unification) ───────
CREATE OR REPLACE FUNCTION public.find_duplicate_person(
  p_exclude_id         UUID,
  p_whatsapp           TEXT DEFAULT NULL,
  p_email              TEXT DEFAULT NULL,
  p_document           TEXT DEFAULT NULL,
  p_instagram_user_id  TEXT DEFAULT NULL,
  p_instagram_handle   TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.clients_people
  WHERE id <> p_exclude_id
    AND status <> 'merged'
    AND (
      (p_whatsapp          IS NOT NULL AND whatsapp          = p_whatsapp) OR
      (p_email             IS NOT NULL AND LOWER(email)      = LOWER(p_email)) OR
      (p_document          IS NOT NULL AND document          = p_document) OR
      (p_instagram_user_id IS NOT NULL AND instagram_user_id = p_instagram_user_id) OR
      (p_instagram_handle  IS NOT NULL AND LOWER(instagram_handle) = LOWER(p_instagram_handle))
    )
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.find_duplicate_person(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_duplicate_person TO authenticated, service_role;

-- ── 5. P6 renames: leads_id→lead_id, users_id→user_id, companies_id→company_id ─
-- Baseline (009) CREATE TABLE usava nomes pré-P6. R2 no REPAIR section devia
-- renomear, mas nunca rodou em tenants onde 009 já estava 'success'.
-- Todos os IF EXISTS garantem idempotência.

DO $fwup12_renames$
BEGIN

  -- meetings: leads_id → lead_id, users_id → user_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meetings' AND column_name = 'leads_id') THEN
    ALTER TABLE public.meetings RENAME COLUMN leads_id TO lead_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meetings' AND column_name = 'users_id') THEN
    ALTER TABLE public.meetings RENAME COLUMN users_id TO user_id;
  END IF;

  -- messages: leads_id → lead_id, users_id → user_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'leads_id') THEN
    ALTER TABLE public.messages RENAME COLUMN leads_id TO lead_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'users_id') THEN
    ALTER TABLE public.messages RENAME COLUMN users_id TO user_id;
  END IF;

  -- leads_notes: leads_id → lead_id, users_id → user_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads_notes' AND column_name = 'leads_id') THEN
    ALTER TABLE public.leads_notes RENAME COLUMN leads_id TO lead_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads_notes' AND column_name = 'users_id') THEN
    ALTER TABLE public.leads_notes RENAME COLUMN users_id TO user_id;
  END IF;

  -- leads_files: leads_id → lead_id, users_id → user_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads_files' AND column_name = 'leads_id') THEN
    ALTER TABLE public.leads_files RENAME COLUMN leads_id TO lead_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads_files' AND column_name = 'users_id') THEN
    ALTER TABLE public.leads_files RENAME COLUMN users_id TO user_id;
  END IF;

  -- leads_updates: leads_id → lead_id, users_id → user_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads_updates' AND column_name = 'leads_id') THEN
    ALTER TABLE public.leads_updates RENAME COLUMN leads_id TO lead_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads_updates' AND column_name = 'users_id') THEN
    ALTER TABLE public.leads_updates RENAME COLUMN users_id TO user_id;
  END IF;

  -- leads: companies_id → company_id, users_id → user_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'companies_id') THEN
    ALTER TABLE public.leads RENAME COLUMN companies_id TO company_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'users_id') THEN
    ALTER TABLE public.leads RENAME COLUMN users_id TO user_id;
  END IF;

  -- ai_agents_steps_history: leads_id → lead_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_agents_steps_history' AND column_name = 'leads_id') THEN
    ALTER TABLE public.ai_agents_steps_history RENAME COLUMN leads_id TO lead_id;
  END IF;

  -- meeting_followup_queue: leads_id → lead_id (guard: baseline já cria com lead_id)
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meeting_followup_queue' AND column_name = 'leads_id') THEN
    ALTER TABLE public.meeting_followup_queue RENAME COLUMN leads_id TO lead_id;
  END IF;

END $fwup12_renames$;

COMMIT;
