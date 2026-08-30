-- Fix save_agent_complete: pipeline_ids and stage_ids columns are text[] in this DB,
-- not uuid[]. The previous RPC version cast them to ::uuid[] which produced
-- "CASE/WHEN could not convert type uuid[] to text[]" because the ELSE branch
-- (the existing column value) is text[] while the THEN branch was uuid[].
--
-- Fix: drop the ::uuid[] cast on pipeline_ids and stage_ids.
-- score_matrix_ids stays ::uuid[] (column IS uuid[]).

CREATE OR REPLACE FUNCTION public.save_agent_complete(
  p_agent_id   uuid,
  p_agent_data jsonb,
  p_steps_data jsonb DEFAULT NULL,
  p_changelog  jsonb DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_version int;
  v_new_version     int;
  v_snapshot        jsonb;
  v_step            jsonb;
  v_step_id         uuid;
BEGIN
  SELECT current_version,
         to_jsonb(a) AS snapshot
  INTO   v_current_version, v_snapshot
  FROM   public.ai_agents a
  WHERE  id = p_agent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agent not found: %', p_agent_id;
  END IF;

  v_snapshot := jsonb_set(
    v_snapshot,
    '{steps}',
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.order_index)
       FROM public.ai_agents_steps s
       WHERE s.ai_agent_id = p_agent_id),
      '[]'::jsonb
    )
  );

  INSERT INTO public.ai_agents_history
    (ai_agent_id, version, data, changelog, created_by)
  VALUES
    (p_agent_id, v_current_version, v_snapshot, p_changelog, p_created_by);

  v_new_version := v_current_version + 1;

  UPDATE public.ai_agents
  SET
    name                = COALESCE((p_agent_data->>'name'),                name),
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
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_agent_data->'stage_ids'))
                               ELSE stage_ids END,
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
    voice_language      = COALESCE((p_agent_data->>'voice_language'),      voice_language),
    voice_model_id      = CASE WHEN p_agent_data ? 'voice_model_id'
                               THEN NULLIF(p_agent_data->>'voice_model_id', '')
                               ELSE voice_model_id END,
    voice_stability     = COALESCE((p_agent_data->>'voice_stability')::numeric,  voice_stability),
    voice_similarity    = COALESCE((p_agent_data->>'voice_similarity')::numeric, voice_similarity),
    voice_speed         = COALESCE((p_agent_data->>'voice_speed')::numeric,      voice_speed),
    el_sync_status      = COALESCE((p_agent_data->>'el_sync_status'),      el_sync_status),
    current_version     = v_new_version,
    updated_at          = now()
  WHERE id = p_agent_id;

  IF p_steps_data IS NOT NULL THEN
    DELETE FROM public.ai_agents_steps
    WHERE ai_agent_id = p_agent_id;

    FOR v_step IN SELECT * FROM jsonb_array_elements(p_steps_data)
    LOOP
      v_step_id := CASE
        WHEN v_step ? 'id'
          AND (v_step->>'id') IS NOT NULL
          AND (v_step->>'id') <> ''
        THEN (v_step->>'id')::uuid
        ELSE gen_random_uuid()
      END;

      INSERT INTO public.ai_agents_steps
        (id, ai_agent_id, name, prompt, control, order_index,
         pipeline_id, stage_id, active, created_at, updated_at)
      VALUES (
        v_step_id,
        p_agent_id,
        v_step->>'name',
        COALESCE(v_step->>'prompt', ''),
        NULLIF(v_step->>'control', ''),
        (v_step->>'order_index')::integer,
        CASE WHEN (v_step->>'pipeline_id') IS NOT NULL AND (v_step->>'pipeline_id') <> ''
             THEN (v_step->>'pipeline_id')::uuid ELSE NULL END,
        CASE WHEN (v_step->>'stage_id') IS NOT NULL AND (v_step->>'stage_id') <> ''
             THEN (v_step->>'stage_id')::uuid ELSE NULL END,
        COALESCE((v_step->>'active')::boolean, true),
        now(),
        now()
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('version', v_new_version, 'ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_agent_complete(uuid, jsonb, jsonb, jsonb, uuid)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.save_agent_complete(uuid, jsonb, jsonb, jsonb, uuid)
  FROM anon;
