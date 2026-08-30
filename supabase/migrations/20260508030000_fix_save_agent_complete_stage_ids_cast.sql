-- ═══════════════════════════════════════════════════════════════════
-- 20260508030000_fix_save_agent_complete_stage_ids_cast.sql
--
-- Root cause: ai_agents.stage_ids is uuid[] but the CASE THEN branch
-- in save_agent_complete produced text[] (no explicit cast). PostgreSQL
-- cannot implicitly unify text[] and uuid[] in a CASE expression →
-- error 42846 "CASE/WHEN could not convert type text[] to uuid[]".
--
-- Fix: add ::uuid[] cast to the stage_ids THEN branch.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.save_agent_complete(
  p_agent_id    uuid,
  p_agent_data  jsonb,
  p_steps_data  jsonb DEFAULT NULL,
  p_changelog   jsonb DEFAULT NULL,
  p_created_by  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_version     integer;
  v_step        jsonb;
  v_step_id     uuid;
  v_created_by  uuid;
BEGIN
  -- Resolve created_by: prefer explicit param, fall back to auth.uid()
  v_created_by := COALESCE(p_created_by, auth.uid());

  -- ── 1. Update agent row ──────────────────────────────────────────────────────
  UPDATE public.ai_agents SET
    name                = CASE WHEN p_agent_data ? 'name'
                               THEN p_agent_data->>'name'
                               ELSE name END,
    description         = CASE WHEN p_agent_data ? 'description'
                               THEN p_agent_data->>'description'
                               ELSE description END,
    identity            = CASE WHEN p_agent_data ? 'identity'
                               THEN p_agent_data->>'identity'
                               ELSE identity END,
    general_rules       = CASE WHEN p_agent_data ? 'general_rules'
                               THEN p_agent_data->>'general_rules'
                               ELSE general_rules END,
    input_data          = CASE WHEN p_agent_data ? 'input_data'
                               THEN p_agent_data->>'input_data'
                               ELSE input_data END,
    use_stages          = COALESCE((p_agent_data->>'use_stages')::boolean, use_stages),
    active              = COALESCE((p_agent_data->>'active')::boolean,     active),
    pipeline_id         = CASE WHEN p_agent_data ? 'pipeline_id'
                               THEN NULLIF(p_agent_data->>'pipeline_id', '')::uuid
                               ELSE pipeline_id END,
    pipeline_ids        = CASE WHEN p_agent_data ? 'pipeline_ids'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_agent_data->'pipeline_ids'))
                               ELSE pipeline_ids END,
    leads_stages_id     = CASE WHEN p_agent_data ? 'leads_stages_id'
                               THEN NULLIF(p_agent_data->>'leads_stages_id', '')::uuid
                               ELSE leads_stages_id END,
    score_matrix_ids    = CASE WHEN p_agent_data ? 'score_matrix_ids'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_agent_data->'score_matrix_ids'))::uuid[]
                               ELSE score_matrix_ids END,
    score_allow_empty   = COALESCE((p_agent_data->>'score_allow_empty')::boolean, score_allow_empty),
    score_value         = COALESCE((p_agent_data->>'score_value')::integer,       score_value),
    channel_types       = CASE WHEN p_agent_data ? 'channel_types'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_agent_data->'channel_types'))
                               ELSE channel_types END,
    stage_ids           = CASE WHEN p_agent_data ? 'stage_ids'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_agent_data->'stage_ids'))::uuid[]
                               ELSE stage_ids END,
    origem_lista_filters = CASE WHEN p_agent_data ? 'origem_lista_filters'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_agent_data->'origem_lista_filters'))
                               ELSE origem_lista_filters END,
    llm_provider        = COALESCE((p_agent_data->>'llm_provider'),        llm_provider),
    llm_model           = COALESCE((p_agent_data->>'llm_model'),           llm_model),
    llm_temperature     = COALESCE((p_agent_data->>'llm_temperature')::numeric,  llm_temperature),
    llm_max_tokens      = COALESCE((p_agent_data->>'llm_max_tokens')::integer,   llm_max_tokens),
    llm_provider_id     = CASE WHEN p_agent_data ? 'llm_provider_id'
                               THEN NULLIF(p_agent_data->>'llm_provider_id', '')::uuid
                               ELSE llm_provider_id END,
    memory_window       = COALESCE((p_agent_data->>'memory_window')::integer,    memory_window),
    wa_phone_number_id  = CASE WHEN p_agent_data ? 'wa_phone_number_id'
                               THEN NULLIF(p_agent_data->>'wa_phone_number_id', '')
                               ELSE wa_phone_number_id END,
    wa_channel_id       = CASE WHEN p_agent_data ? 'wa_channel_id'
                               THEN NULLIF(p_agent_data->>'wa_channel_id', '')::uuid
                               ELSE wa_channel_id END,
    buffer_ms           = COALESCE((p_agent_data->>'buffer_ms')::integer,  buffer_ms),
    humanizacao         = COALESCE((p_agent_data->>'humanizacao'),         humanizacao),
    agent_type          = COALESCE((p_agent_data->>'agent_type'),          agent_type),
    voice_enabled       = COALESCE((p_agent_data->>'voice_enabled')::boolean,    voice_enabled),
    voice_response_mode = COALESCE((p_agent_data->>'voice_response_mode'), voice_response_mode),
    voice_id            = CASE WHEN p_agent_data ? 'voice_id'
                               THEN NULLIF(p_agent_data->>'voice_id', '')
                               ELSE voice_id END,
    voice_first_message = CASE WHEN p_agent_data ? 'voice_first_message'
                               THEN p_agent_data->>'voice_first_message'
                               ELSE voice_first_message END,
    voice_language      = CASE WHEN p_agent_data ? 'voice_language'
                               THEN p_agent_data->>'voice_language'
                               ELSE voice_language END,
    voice_model_id      = CASE WHEN p_agent_data ? 'voice_model_id'
                               THEN p_agent_data->>'voice_model_id'
                               ELSE voice_model_id END,
    voice_stability     = CASE WHEN p_agent_data ? 'voice_stability'
                               THEN (p_agent_data->>'voice_stability')::numeric
                               ELSE voice_stability END,
    voice_similarity    = CASE WHEN p_agent_data ? 'voice_similarity'
                               THEN (p_agent_data->>'voice_similarity')::numeric
                               ELSE voice_similarity END,
    voice_speed         = CASE WHEN p_agent_data ? 'voice_speed'
                               THEN (p_agent_data->>'voice_speed')::numeric
                               ELSE voice_speed END,
    el_sync_status      = CASE WHEN p_agent_data ? 'el_sync_status'
                               THEN p_agent_data->>'el_sync_status'
                               ELSE el_sync_status END,
    updated_at          = now()
  WHERE id = p_agent_id;

  -- ── 2. Upsert steps (if provided) ───────────────────────────────────────────
  IF p_steps_data IS NOT NULL THEN
    -- Delete steps no longer present
    DELETE FROM public.ai_agents_steps
    WHERE ai_agent_id = p_agent_id
      AND id NOT IN (
        SELECT (step->>'id')::uuid
        FROM jsonb_array_elements(p_steps_data) AS step
        WHERE step ? 'id'
      );

    -- Upsert each step
    FOR v_step IN SELECT * FROM jsonb_array_elements(p_steps_data)
    LOOP
      IF v_step ? 'id' THEN
        v_step_id := (v_step->>'id')::uuid;
        INSERT INTO public.ai_agents_steps (id, ai_agent_id, name, prompt, control, order_index, active)
        VALUES (
          v_step_id,
          p_agent_id,
          v_step->>'name',
          v_step->>'prompt',
          v_step->>'control',
          COALESCE((v_step->>'order_index')::integer, 1),
          true
        )
        ON CONFLICT (id) DO UPDATE SET
          name        = EXCLUDED.name,
          prompt      = EXCLUDED.prompt,
          control     = EXCLUDED.control,
          order_index = EXCLUDED.order_index,
          updated_at  = now();
      ELSE
        INSERT INTO public.ai_agents_steps (ai_agent_id, name, prompt, control, order_index, active)
        VALUES (
          p_agent_id,
          v_step->>'name',
          v_step->>'prompt',
          v_step->>'control',
          COALESCE((v_step->>'order_index')::integer, 1),
          true
        );
      END IF;
    END LOOP;
  END IF;

  -- ── 3. Insert history entry ──────────────────────────────────────────────────
  INSERT INTO public.ai_agents_history (ai_agent_id, changelog, created_by)
  VALUES (p_agent_id, COALESCE(p_changelog, '{}'::jsonb), v_created_by)
  RETURNING version INTO v_version;

  RETURN jsonb_build_object('ok', true, 'version', v_version);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_agent_complete(uuid, jsonb, jsonb, jsonb, uuid)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_agent_complete(uuid, jsonb, jsonb, jsonb, uuid)
  FROM anon;

COMMIT;
