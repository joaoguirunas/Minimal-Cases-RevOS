-- ============================================
-- ETAPA 6: FUNCTIONS DO BANCO
-- ============================================

-- ----------------------------------------
-- 6.1 FUNÇÃO UPDATE_UPDATED_AT_COLUMN
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Criar triggers para todas as tabelas com updated_at
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_users_updated_at BEFORE UPDATE ON public.settings_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_teams_updated_at BEFORE UPDATE ON public.settings_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_schedules_updated_at BEFORE UPDATE ON public.settings_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_system_modules_updated_at BEFORE UPDATE ON public.settings_system_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_people_updated_at BEFORE UPDATE ON public.clients_people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_companies_updated_at BEFORE UPDATE ON public.clients_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_pipelines_updated_at BEFORE UPDATE ON public.leads_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_stages_updated_at BEFORE UPDATE ON public.leads_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_stages_followups_updated_at BEFORE UPDATE ON public.leads_stages_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_loss_reasons_updated_at BEFORE UPDATE ON public.leads_loss_reasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_notes_updated_at BEFORE UPDATE ON public.leads_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_score_objectives_updated_at BEFORE UPDATE ON public.score_objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_score_investments_updated_at BEFORE UPDATE ON public.score_investments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_score_framings_updated_at BEFORE UPDATE ON public.score_framings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_score_matrix_updated_at BEFORE UPDATE ON public.score_matrix
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sends_updated_at BEFORE UPDATE ON public.sends
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_templates_updated_at BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_agents_steps_updated_at BEFORE UPDATE ON public.ai_agents_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- 6.2 FUNÇÃO IMPORT_PESSOA_WITH_FLEXIBLE_LEAD
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.import_pessoa_with_flexible_lead(
  modo_operacao text,
  pessoa_data jsonb,
  pipeline_id_param uuid DEFAULT NULL,
  tenant_id_param text DEFAULT 'single-tenant'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pessoa_id UUID;
  v_lead_id UUID;
  v_first_stage_id UUID;
  v_whatsapp TEXT;
  v_email TEXT;
  v_nome TEXT;
  v_existing_pessoa_id UUID;
BEGIN
  v_whatsapp := pessoa_data->>'whatsapp';
  v_email := pessoa_data->>'email';
  v_nome := pessoa_data->>'nome';

  IF v_nome IS NULL OR v_nome = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome é obrigatório');
  END IF;

  IF v_whatsapp IS NULL OR v_whatsapp = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'WhatsApp é obrigatório');
  END IF;

  SELECT id INTO v_existing_pessoa_id
  FROM public.clients_people
  WHERE whatsapp = v_whatsapp
  LIMIT 1;

  IF v_existing_pessoa_id IS NOT NULL THEN
    v_pessoa_id := v_existing_pessoa_id;
    
    UPDATE public.clients_people
    SET
      name = COALESCE(v_nome, name),
      email = COALESCE(v_email, email),
      document = COALESCE(pessoa_data->>'documento', document),
      notes = COALESCE(pessoa_data->>'observacoes', notes),
      updated_at = NOW()
    WHERE id = v_pessoa_id;
  ELSE
    INSERT INTO public.clients_people (
      name, email, whatsapp, document, notes,
      accepts_calls, status, created_at, updated_at
    ) VALUES (
      v_nome, v_email, v_whatsapp,
      pessoa_data->>'documento',
      pessoa_data->>'observacoes',
      COALESCE((pessoa_data->>'aceita_ligacao')::boolean, true),
      COALESCE(pessoa_data->>'status', 'ativo'),
      NOW(), NOW()
    )
    RETURNING id INTO v_pessoa_id;
  END IF;

  IF modo_operacao = 'criar' AND pipeline_id_param IS NOT NULL THEN
    SELECT id INTO v_first_stage_id
    FROM public.leads_stages
    WHERE leads_pipelines_id = pipeline_id_param AND active = true
    ORDER BY order_index ASC
    LIMIT 1;

    IF v_first_stage_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'pessoa_id', v_pessoa_id,
        'error', 'Pipeline não possui etapas ativas'
      );
    END IF;

    INSERT INTO public.leads (
      title, people_id, leads_pipelines_id, leads_stages_id,
      status, created_at, updated_at
    ) VALUES (
      'Lead - ' || v_nome, v_pessoa_id, pipeline_id_param,
      v_first_stage_id, 'em-andamento', NOW(), NOW()
    )
    RETURNING id INTO v_lead_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pessoa_id', v_pessoa_id,
    'lead_id', v_lead_id,
    'is_new', (v_existing_pessoa_id IS NULL)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ----------------------------------------
-- 6.3 FUNÇÃO IMPORT_AGENDAMENTO
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.import_agendamento(meeting_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pessoa_id uuid;
  lead_id_param uuid;
  meeting_id uuid;
  usuario_id uuid;
  pipeline_id_param uuid;
  stage_id_param uuid;
  resultado jsonb;
  meeting_start_time timestamp with time zone;
  meeting_end_time timestamp with time zone;
BEGIN
  SELECT id INTO pessoa_id
  FROM clients_people
  WHERE whatsapp = meeting_data->>'pessoa_whatsapp'
  LIMIT 1;
  
  IF pessoa_id IS NULL THEN
    INSERT INTO clients_people (
      name, whatsapp, status, created_at, updated_at
    ) VALUES (
      COALESCE(meeting_data->>'pessoa_nome', 'Cliente ' || (meeting_data->>'pessoa_whatsapp')),
      meeting_data->>'pessoa_whatsapp', 'ativo', now(), now()
    ) RETURNING id INTO pessoa_id;
  END IF;
  
  SELECT id INTO lead_id_param
  FROM leads
  WHERE people_id = pessoa_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF lead_id_param IS NULL THEN
    IF meeting_data->>'pipeline_id' IS NOT NULL THEN
      pipeline_id_param = (meeting_data->>'pipeline_id')::uuid;
    ELSE
      SELECT id INTO pipeline_id_param
      FROM leads_pipelines
      WHERE active = true
      ORDER BY created_at
      LIMIT 1;
    END IF;
    
    IF pipeline_id_param IS NULL THEN
      RETURN jsonb_build_object('erro', 'Nenhum pipeline ativo encontrado', 'operacao', 'falhou');
    END IF;
    
    SELECT id INTO stage_id_param
    FROM leads_stages
    WHERE leads_pipelines_id = pipeline_id_param AND active = true
    ORDER BY order_index
    LIMIT 1;
    
    IF stage_id_param IS NULL THEN
      RETURN jsonb_build_object('erro', 'Nenhuma etapa encontrada para o pipeline', 'operacao', 'falhou');
    END IF;
    
    INSERT INTO leads (
      people_id, leads_pipelines_id, leads_stages_id,
      title, status, created_at, updated_at
    ) VALUES (
      pessoa_id, pipeline_id_param, stage_id_param,
      'Lead - ' || COALESCE(meeting_data->>'pessoa_nome', meeting_data->>'pessoa_whatsapp'),
      'em-andamento', now(), now()
    ) RETURNING id INTO lead_id_param;
  END IF;
  
  IF meeting_data->>'responsavel_email' IS NOT NULL THEN
    SELECT id INTO usuario_id
    FROM settings_users
    WHERE email = meeting_data->>'responsavel_email' AND active = true
    LIMIT 1;
  END IF;
  
  meeting_start_time = ((meeting_data->>'data') || ' ' || (meeting_data->>'hora_inicio') || ':00')::timestamp with time zone;
  meeting_end_time = ((meeting_data->>'data') || ' ' || (meeting_data->>'hora_fim') || ':00')::timestamp with time zone;
  
  INSERT INTO meetings (
    leads_id, people_id, users_id, start_time, end_time,
    title, location, notes, status, created_at, updated_at
  ) VALUES (
    lead_id_param, pessoa_id, usuario_id,
    meeting_start_time, meeting_end_time,
    COALESCE(meeting_data->>'titulo', 'Reunião - ' || COALESCE(meeting_data->>'pessoa_nome', meeting_data->>'pessoa_whatsapp')),
    meeting_data->>'localizacao',
    meeting_data->>'observacoes',
    COALESCE(meeting_data->>'status', 'agendada'),
    now(), now()
  ) RETURNING id INTO meeting_id;
  
  resultado = jsonb_build_object(
    'meeting_id', meeting_id,
    'lead_id', lead_id_param,
    'pessoa_id', pessoa_id,
    'operacao', 'criado'
  );
  
  RETURN resultado;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('erro', SQLERRM, 'operacao', 'falhou');
END;
$$;

-- ----------------------------------------
-- 6.4 FUNÇÃO REORDER_LEADS_STAGE
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.reorder_leads_stage(
  p_stage_id uuid,
  p_pipeline_id uuid,
  p_new_position integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_pos integer;
  v_max_pos integer;
  v_target_pos integer;
BEGIN
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS pos
    FROM public.leads_stages
    WHERE leads_pipelines_id = p_pipeline_id AND active = true
  )
  SELECT pos, (SELECT MAX(pos) FROM ordered)
  INTO v_current_pos, v_max_pos
  FROM ordered
  WHERE id = p_stage_id;

  IF v_current_pos IS NULL OR v_max_pos IS NULL THEN
    RETURN;
  END IF;

  v_target_pos := GREATEST(1, LEAST(p_new_position, v_max_pos));

  IF v_target_pos = v_current_pos THEN
    RETURN;
  END IF;

  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS pos
    FROM public.leads_stages
    WHERE leads_pipelines_id = p_pipeline_id AND active = true
  ),
  moved AS (
    SELECT
      id,
      CASE
        WHEN pos = v_current_pos THEN v_target_pos
        WHEN v_target_pos < v_current_pos
             AND pos >= v_target_pos
             AND pos < v_current_pos
          THEN pos + 1
        WHEN v_target_pos > v_current_pos
             AND pos <= v_target_pos
             AND pos > v_current_pos
          THEN pos - 1
        ELSE pos
      END AS new_pos
    FROM ordered
  )
  UPDATE public.leads_stages ls
  SET order_index = m.new_pos
  FROM moved m
  WHERE ls.id = m.id;
END;
$$;