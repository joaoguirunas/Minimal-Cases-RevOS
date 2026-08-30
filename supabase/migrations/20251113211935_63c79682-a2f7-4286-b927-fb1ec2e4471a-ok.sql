-- Corrigir função import_agendamento para usar start_time e end_time corretamente
DROP FUNCTION IF EXISTS import_agendamento(jsonb);

CREATE OR REPLACE FUNCTION import_agendamento(
  meeting_data jsonb
)
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
  -- Buscar ou criar pessoa pelo WhatsApp
  SELECT id INTO pessoa_id
  FROM clients_people
  WHERE whatsapp = meeting_data->>'pessoa_whatsapp'
  LIMIT 1;
  
  IF pessoa_id IS NULL THEN
    -- Criar nova pessoa
    INSERT INTO clients_people (
      name,
      whatsapp,
      status,
      created_at,
      updated_at
    ) VALUES (
      COALESCE(meeting_data->>'pessoa_nome', 'Cliente ' || (meeting_data->>'pessoa_whatsapp')),
      meeting_data->>'pessoa_whatsapp',
      'ativo',
      now(),
      now()
    ) RETURNING id INTO pessoa_id;
  END IF;
  
  -- Buscar lead existente ou criar novo
  SELECT id INTO lead_id_param
  FROM leads
  WHERE people_id = pessoa_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF lead_id_param IS NULL THEN
    -- Buscar pipeline padrão ou usar o fornecido
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
      RETURN jsonb_build_object(
        'erro', 'Nenhum pipeline ativo encontrado',
        'operacao', 'falhou'
      );
    END IF;
    
    -- Buscar primeira etapa do pipeline
    SELECT id INTO stage_id_param
    FROM leads_stages
    WHERE leads_pipelines_id = pipeline_id_param
      AND active = true
    ORDER BY order_index
    LIMIT 1;
    
    IF stage_id_param IS NULL THEN
      RETURN jsonb_build_object(
        'erro', 'Nenhuma etapa encontrada para o pipeline',
        'operacao', 'falhou'
      );
    END IF;
    
    -- Criar lead
    INSERT INTO leads (
      people_id,
      leads_pipelines_id,
      leads_stages_id,
      title,
      status,
      created_at,
      updated_at
    ) VALUES (
      pessoa_id,
      pipeline_id_param,
      stage_id_param,
      'Lead - ' || COALESCE(meeting_data->>'pessoa_nome', meeting_data->>'pessoa_whatsapp'),
      'em-andamento',
      now(),
      now()
    ) RETURNING id INTO lead_id_param;
  END IF;
  
  -- Buscar usuário responsável
  IF meeting_data->>'responsavel_email' IS NOT NULL THEN
    SELECT id INTO usuario_id
    FROM settings_users
    WHERE email = meeting_data->>'responsavel_email'
      AND active = true
    LIMIT 1;
  END IF;
  
  -- Construir timestamps combinando data + hora
  meeting_start_time = ((meeting_data->>'data') || ' ' || (meeting_data->>'hora_inicio') || ':00')::timestamp with time zone;
  meeting_end_time = ((meeting_data->>'data') || ' ' || (meeting_data->>'hora_fim') || ':00')::timestamp with time zone;
  
  -- Criar agendamento (meetings não tem coluna 'date', só start_time e end_time)
  INSERT INTO meetings (
    leads_id,
    people_id,
    users_id,
    start_time,
    end_time,
    title,
    location,
    notes,
    status,
    created_at,
    updated_at
  ) VALUES (
    lead_id_param,
    pessoa_id,
    usuario_id,
    meeting_start_time,
    meeting_end_time,
    COALESCE(meeting_data->>'titulo', 'Reunião - ' || COALESCE(meeting_data->>'pessoa_nome', meeting_data->>'pessoa_whatsapp')),
    meeting_data->>'localizacao',
    meeting_data->>'observacoes',
    COALESCE(meeting_data->>'status', 'agendada'),
    now(),
    now()
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
    RETURN jsonb_build_object(
      'erro', SQLERRM,
      'operacao', 'falhou'
    );
END;
$$;