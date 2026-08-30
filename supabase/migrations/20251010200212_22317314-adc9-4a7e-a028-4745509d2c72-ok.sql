-- Atualizar função de importar conversas para criar lead automaticamente
DROP FUNCTION IF EXISTS import_conversa(jsonb);

CREATE OR REPLACE FUNCTION import_conversa(
  conversa_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pessoa_id uuid;
  lead_id_param uuid;
  message_id integer;
  pipeline_id_param uuid;
  stage_id_param uuid;
  resultado jsonb;
BEGIN
  -- Buscar ou criar pessoa pelo WhatsApp
  SELECT id INTO pessoa_id
  FROM clients_people
  WHERE whatsapp = conversa_data->>'pessoa_whatsapp'
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
      COALESCE(conversa_data->>'pessoa_nome', 'Cliente ' || (conversa_data->>'pessoa_whatsapp')),
      conversa_data->>'pessoa_whatsapp',
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
    IF conversa_data->>'pipeline_id' IS NOT NULL THEN
      pipeline_id_param = (conversa_data->>'pipeline_id')::uuid;
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
      'Lead - ' || COALESCE(conversa_data->>'pessoa_nome', conversa_data->>'pessoa_whatsapp'),
      'em-andamento',
      now(),
      now()
    ) RETURNING id INTO lead_id_param;
  END IF;
  
  -- Inserir mensagem
  INSERT INTO messages (
    leads_id,
    people_id,
    content,
    from_contact,
    message_type,
    channel,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    lead_id_param,
    pessoa_id,
    conversa_data->>'conteudo',
    conversa_data->>'from_contact',
    COALESCE(conversa_data->>'tipo_mensagem', 'texto'),
    COALESCE(conversa_data->>'canal', 'whatsapp'),
    COALESCE((conversa_data->>'metadata')::jsonb, '{}'::jsonb),
    now(),
    now()
  ) RETURNING id INTO message_id;
  
  resultado = jsonb_build_object(
    'message_id', message_id,
    'lead_id', lead_id_param,
    'pessoa_id', pessoa_id,
    'operacao', 'criada'
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

-- Atualizar função de importar agendamentos para criar lead automaticamente
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
      AND ativo = true
    LIMIT 1;
  END IF;
  
  -- Criar agendamento
  INSERT INTO meetings (
    leads_id,
    users_id,
    date,
    start_time,
    end_time,
    location,
    notes,
    status,
    created_at
  ) VALUES (
    lead_id_param,
    usuario_id,
    (meeting_data->>'data')::date,
    (meeting_data->>'hora_inicio')::time,
    (meeting_data->>'hora_fim')::time,
    meeting_data->>'localizacao',
    meeting_data->>'observacoes',
    COALESCE(meeting_data->>'status', 'agendado'),
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