-- FWUP-13: Baseline repair — sem transação explícita (auto-commit por statement)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROBLEMA:
--   FWUP-12 usava BEGIN/COMMIT. O baseline (009) tem BEGIN sem COMMIT no final,
--   deixando a conexão compartilhada em transação aberta. O BEGIN de FWUP-12
--   vira no-op (WARNING "já em transação") e o COMMIT de FWUP-12 commita
--   até ali — mas um ROLLBACK subsequente de migration posterior desfaz tudo.
--   Resultado: migration marcada 'success' mas colunas não persistem.
--
-- SOLUÇÃO:
--   Sem BEGIN/COMMIT. Cada ALTER TABLE e DO block auto-commita individualmente
--   na conexão compartilhada, independente do estado de transação anterior.
--
-- IDEMPOTENTE: todos os blocos usam IF NOT EXISTS ou EXCEPTION WHEN OTHERS.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. ai_agents: template_type ──────────────────────────────────────────────
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS template_type text;

-- ── 2. ai_agents: llm_model ──────────────────────────────────────────────────
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS llm_model text NOT NULL DEFAULT 'gpt-4o-mini';

-- ── 3. lead_field_definitions: agent_managed ─────────────────────────────────
ALTER TABLE public.lead_field_definitions
  ADD COLUMN IF NOT EXISTS agent_managed boolean NOT NULL DEFAULT false;

-- ── 4. settings_whatsapp_channels: meta_template_name ────────────────────────
ALTER TABLE public.settings_whatsapp_channels
  ADD COLUMN IF NOT EXISTS meta_template_name text;

-- ── 5. find_duplicate_person ─────────────────────────────────────────────────
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
GRANT EXECUTE ON FUNCTION public.find_duplicate_person(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ── 6. P6 renames — cada DO block commita individualmente ────────────────────

-- meetings: leads_id → lead_id
DO $r01$
BEGIN
  ALTER TABLE public.meetings RENAME COLUMN leads_id TO lead_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r01$;

-- meetings: users_id → user_id
DO $r02$
BEGIN
  ALTER TABLE public.meetings RENAME COLUMN users_id TO user_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r02$;

-- messages: leads_id → lead_id
DO $r03$
BEGIN
  ALTER TABLE public.messages RENAME COLUMN leads_id TO lead_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r03$;

-- messages: users_id → user_id
DO $r04$
BEGIN
  ALTER TABLE public.messages RENAME COLUMN users_id TO user_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r04$;

-- leads_notes: leads_id → lead_id
DO $r05$
BEGIN
  ALTER TABLE public.leads_notes RENAME COLUMN leads_id TO lead_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r05$;

-- leads_notes: users_id → user_id
DO $r06$
BEGIN
  ALTER TABLE public.leads_notes RENAME COLUMN users_id TO user_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r06$;

-- leads_files: leads_id → lead_id
DO $r07$
BEGIN
  ALTER TABLE public.leads_files RENAME COLUMN leads_id TO lead_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r07$;

-- leads_files: users_id → user_id
DO $r08$
BEGIN
  ALTER TABLE public.leads_files RENAME COLUMN users_id TO user_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r08$;

-- leads_updates: leads_id → lead_id
DO $r09$
BEGIN
  ALTER TABLE public.leads_updates RENAME COLUMN leads_id TO lead_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r09$;

-- leads_updates: users_id → user_id
DO $r10$
BEGIN
  ALTER TABLE public.leads_updates RENAME COLUMN users_id TO user_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r10$;

-- leads: companies_id → company_id
DO $r11$
BEGIN
  ALTER TABLE public.leads RENAME COLUMN companies_id TO company_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r11$;

-- leads: users_id → user_id
DO $r12$
BEGIN
  ALTER TABLE public.leads RENAME COLUMN users_id TO user_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r12$;

-- ai_agents_steps_history: leads_id → lead_id
DO $r13$
BEGIN
  ALTER TABLE public.ai_agents_steps_history RENAME COLUMN leads_id TO lead_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r13$;

-- meeting_followup_queue: leads_id → lead_id
DO $r14$
BEGIN
  ALTER TABLE public.meeting_followup_queue RENAME COLUMN leads_id TO lead_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $r14$;
