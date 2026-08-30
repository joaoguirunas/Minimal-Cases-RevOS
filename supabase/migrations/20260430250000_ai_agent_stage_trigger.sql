-- =============================================================================
-- AI Agent Stage Trigger
--
-- When a lead enters a pipeline stage, the DB trigger notify_lead_stage_changed
-- previously only fired dispara-webhook (tipo='lead_etapa').
--
-- This migration extends the trigger to also call ai-agent-execute proactively
-- when any ai_agents row has stage_ids containing the new stage AND the lead's
-- person has ai_enabled = true.
--
-- The edge function receives { people_id, stage_trigger: true }, which bypasses
-- the message_buffer requirement and uses loadAgentForStageEntry routing (stage
-- match regardless of channel_types constraint).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_lead_stage_changed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
  v_people_id    UUID;
  v_ai_enabled   BOOLEAN;
  v_agent_exists BOOLEAN;
BEGIN
  -- Only fire when stage actually changes (skip if unchanged on UPDATE)
  IF TG_OP = 'UPDATE' AND OLD.leads_stages_id IS NOT DISTINCT FROM NEW.leads_stages_id THEN
    RETURN NEW;
  END IF;

  -- Skip if no stage assigned
  IF NEW.leads_stages_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_key  := current_setting('app.service_role_key', true);

  -- Silently skip if settings not configured
  IF v_supabase_url IS NULL OR v_supabase_url = ''
     OR v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  -- 1. Always fire dispara-webhook for lead_etapa events
  PERFORM extensions.http_post(
    url     := v_supabase_url || '/functions/v1/dispara-webhook',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'tipo',    'lead_etapa',
      'lead_id', NEW.id::text
    )
  );

  -- 2. Check if any active ai_agents target this stage
  SELECT EXISTS(
    SELECT 1 FROM public.ai_agents
    WHERE active = true
      AND is_template = false
      AND (
        stage_ids @> ARRAY[NEW.leads_stages_id]
        OR (
          -- also check scalar leads_stages_id (legacy single-stage field)
          leads_stages_id = NEW.leads_stages_id
        )
      )
  ) INTO v_agent_exists;

  IF NOT v_agent_exists THEN
    RETURN NEW;
  END IF;

  -- 3. Get the lead's person and check ai_enabled
  v_people_id := NEW.people_id;

  IF v_people_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ai_enabled INTO v_ai_enabled
    FROM public.clients_people
    WHERE id = v_people_id;

  IF v_ai_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- 4. Proactively call ai-agent-execute with stage_trigger=true
  PERFORM extensions.http_post(
    url     := v_supabase_url || '/functions/v1/ai-agent-execute',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'people_id',     v_people_id::text,
      'stage_trigger', true
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block lead updates due to webhook/agent failures
  RETURN NEW;
END;
$$;

-- Trigger is already registered as on_lead_stage_changed — just replace the function.
-- No need to recreate the trigger itself.
