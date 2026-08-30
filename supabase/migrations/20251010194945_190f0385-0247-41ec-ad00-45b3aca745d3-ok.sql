-- Função para importar empresas
CREATE OR REPLACE FUNCTION import_empresa(
  empresa_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  empresa_id uuid;
  existing_empresa uuid;
  resultado jsonb;
BEGIN
  -- Verificar se já existe empresa por CNPJ ou nome fantasia
  SELECT id INTO existing_empresa
  FROM clients_companies
  WHERE (tax_id = (empresa_data->>'cnpj') AND tax_id IS NOT NULL AND tax_id != '')
     OR (trade_name = (empresa_data->>'nome_fantasia') AND trade_name IS NOT NULL);
  
  IF existing_empresa IS NOT NULL THEN
    -- Atualizar empresa existente
    UPDATE clients_companies
    SET
      trade_name = COALESCE(empresa_data->>'nome_fantasia', trade_name),
      legal_name = COALESCE(empresa_data->>'razao_social', legal_name),
      tax_id = COALESCE(empresa_data->>'cnpj', tax_id),
      phone = COALESCE(empresa_data->>'telefone', phone),
      email = COALESCE(empresa_data->>'email', email),
      website = COALESCE(empresa_data->>'website', website),
      notes = COALESCE(empresa_data->>'observacoes', notes),
      updated_at = now()
    WHERE id = existing_empresa;
    
    resultado = jsonb_build_object(
      'empresa_id', existing_empresa,
      'operacao', 'atualizada'
    );
  ELSE
    -- Criar nova empresa
    INSERT INTO clients_companies (
      trade_name,
      legal_name,
      tax_id,
      phone,
      email,
      website,
      notes,
      status,
      created_at,
      updated_at
    ) VALUES (
      empresa_data->>'nome_fantasia',
      empresa_data->>'razao_social',
      empresa_data->>'cnpj',
      empresa_data->>'telefone',
      empresa_data->>'email',
      empresa_data->>'website',
      empresa_data->>'observacoes',
      'ativo',
      now(),
      now()
    ) RETURNING id INTO empresa_id;
    
    resultado = jsonb_build_object(
      'empresa_id', empresa_id,
      'operacao', 'criada'
    );
  END IF;
  
  RETURN resultado;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'erro', SQLERRM,
      'operacao', 'falhou'
    );
END;
$$;

-- Função para importar conversas/mensagens
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
  resultado jsonb;
BEGIN
  -- Buscar pessoa pelo WhatsApp se fornecido
  IF conversa_data->>'pessoa_whatsapp' IS NOT NULL THEN
    SELECT id INTO pessoa_id
    FROM clients_people
    WHERE whatsapp = conversa_data->>'pessoa_whatsapp'
    LIMIT 1;
  END IF;
  
  -- Usar lead_id fornecido ou buscar pelo pessoa_id
  IF conversa_data->>'lead_id' IS NOT NULL THEN
    lead_id_param = (conversa_data->>'lead_id')::uuid;
  ELSIF pessoa_id IS NOT NULL THEN
    SELECT id INTO lead_id_param
    FROM leads
    WHERE people_id = pessoa_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  -- Verificar se temos os dados necessários
  IF lead_id_param IS NULL THEN
    RETURN jsonb_build_object(
      'erro', 'Lead não encontrado para esta pessoa',
      'operacao', 'falhou'
    );
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

-- Função para importar lead completo (pessoa + lead)
CREATE OR REPLACE FUNCTION import_lead_completo(
  lead_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pessoa_id uuid;
  lead_id uuid;
  usuario_id uuid;
  existing_pessoa uuid;
  resultado jsonb;
BEGIN
  -- Buscar pessoa existente por whatsapp ou email
  SELECT id INTO existing_pessoa
  FROM clients_people
  WHERE (whatsapp = lead_data->>'pessoa_whatsapp' AND whatsapp IS NOT NULL)
     OR (email = lead_data->>'pessoa_email' AND email IS NOT NULL)
  LIMIT 1;
  
  IF existing_pessoa IS NOT NULL THEN
    pessoa_id = existing_pessoa;
  ELSE
    -- Criar nova pessoa
    INSERT INTO clients_people (
      name,
      whatsapp,
      email,
      status,
      created_at,
      updated_at
    ) VALUES (
      lead_data->>'pessoa_nome',
      lead_data->>'pessoa_whatsapp',
      lead_data->>'pessoa_email',
      'ativo',
      now(),
      now()
    ) RETURNING id INTO pessoa_id;
  END IF;
  
  -- Buscar usuário responsável se fornecido
  IF lead_data->>'responsavel_email' IS NOT NULL THEN
    SELECT id INTO usuario_id
    FROM settings_users
    WHERE email = lead_data->>'responsavel_email'
      AND ativo = true
    LIMIT 1;
  END IF;
  
  -- Criar lead
  INSERT INTO leads (
    people_id,
    leads_pipelines_id,
    leads_stages_id,
    users_id,
    title,
    value,
    status,
    created_at,
    updated_at
  ) VALUES (
    pessoa_id,
    (lead_data->>'pipeline_id')::uuid,
    (lead_data->>'stage_id')::uuid,
    usuario_id,
    lead_data->>'titulo',
    CASE 
      WHEN lead_data->>'valor' IS NOT NULL 
      THEN (lead_data->>'valor')::numeric
      ELSE NULL
    END,
    COALESCE(lead_data->>'status', 'em-andamento'),
    now(),
    now()
  ) RETURNING id INTO lead_id;
  
  resultado = jsonb_build_object(
    'lead_id', lead_id,
    'pessoa_id', pessoa_id,
    'operacao', CASE WHEN existing_pessoa IS NOT NULL THEN 'pessoa_existente' ELSE 'pessoa_criada' END
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

-- Função para importar agendamentos
CREATE OR REPLACE FUNCTION import_agendamento(
  meeting_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meeting_id uuid;
  usuario_id uuid;
  lead_exists boolean;
  resultado jsonb;
BEGIN
  -- Verificar se lead existe
  SELECT EXISTS(
    SELECT 1 FROM leads WHERE id = (meeting_data->>'lead_id')::uuid
  ) INTO lead_exists;
  
  IF NOT lead_exists THEN
    RETURN jsonb_build_object(
      'erro', 'Lead não encontrado',
      'operacao', 'falhou'
    );
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
    (meeting_data->>'lead_id')::uuid,
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