-- Atualizar função RPC para suportar novos campos de score
CREATE OR REPLACE FUNCTION public.import_pessoa_with_flexible_lead(
  pessoa_data jsonb, 
  pipeline_id_param uuid DEFAULT NULL::uuid, 
  tenant_id_param text DEFAULT NULL::text, 
  modo_operacao text DEFAULT 'nenhum'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pessoa_id uuid;
  lead_id uuid;
  existing_pessoa uuid;
  pipeline_id_selected uuid;
  stage_id_selected uuid;
  operacao_pessoa text;
  operacao_negocio text := NULL;
BEGIN
  -- Buscar pessoa existente por email ou whatsapp
  SELECT id INTO existing_pessoa
  FROM clients_people
  WHERE (email = (pessoa_data->>'email') AND email IS NOT NULL AND email != '')
     OR (whatsapp = (pessoa_data->>'whatsapp') AND whatsapp IS NOT NULL AND whatsapp != '')
  LIMIT 1;
  
  IF existing_pessoa IS NOT NULL THEN
    -- Atualizar pessoa existente
    UPDATE clients_people
    SET
      name = COALESCE(pessoa_data->>'nome', name),
      email = COALESCE(pessoa_data->>'email', email),
      whatsapp = COALESCE(pessoa_data->>'whatsapp', whatsapp),
      document = COALESCE(pessoa_data->>'documento', document),
      notes = COALESCE(pessoa_data->>'observacoes', notes),
      accepts_calls = COALESCE((pessoa_data->>'aceita_ligacao')::boolean, accepts_calls),
      score = COALESCE((pessoa_data->>'score')::integer, score),
      income = COALESCE(pessoa_data->>'renda', income),
      moment = COALESCE(pessoa_data->>'momento', moment),
      goal = COALESCE(pessoa_data->>'objetivo', goal),
      score_framing_id = COALESCE((pessoa_data->>'score_framing_id')::uuid, score_framing_id),
      score_income_id = COALESCE((pessoa_data->>'score_income_id')::uuid, score_income_id),
      score_objective_id = COALESCE((pessoa_data->>'score_objective_id')::uuid, score_objective_id),
      updated_at = now()
    WHERE id = existing_pessoa;
    
    pessoa_id = existing_pessoa;
    operacao_pessoa = 'atualizada';
  ELSE
    -- Criar nova pessoa
    INSERT INTO clients_people (
      name,
      email,
      whatsapp,
      document,
      notes,
      accepts_calls,
      score,
      income,
      moment,
      goal,
      score_framing_id,
      score_income_id,
      score_objective_id,
      status,
      created_at,
      updated_at
    ) VALUES (
      pessoa_data->>'nome',
      pessoa_data->>'email',
      pessoa_data->>'whatsapp',
      pessoa_data->>'documento',
      pessoa_data->>'observacoes',
      COALESCE((pessoa_data->>'aceita_ligacao')::boolean, true),
      COALESCE((pessoa_data->>'score')::integer, NULL),
      pessoa_data->>'renda',
      pessoa_data->>'momento',
      pessoa_data->>'objetivo',
      (pessoa_data->>'score_framing_id')::uuid,
      (pessoa_data->>'score_income_id')::uuid,
      (pessoa_data->>'score_objective_id')::uuid,
      COALESCE(pessoa_data->>'status', 'ativo'),
      now(),
      now()
    ) RETURNING id INTO pessoa_id;
    
    operacao_pessoa = 'criada';
  END IF;
  
  -- Processar lead se modo_operacao != 'nenhum'
  IF modo_operacao != 'nenhum' THEN
    -- Buscar lead existente para esta pessoa
    SELECT id INTO lead_id
    FROM leads
    WHERE people_id = pessoa_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Determinar pipeline
    IF pipeline_id_param IS NOT NULL THEN
      pipeline_id_selected = pipeline_id_param;
    ELSE
      -- Buscar pipeline ativo padrão
      SELECT id INTO pipeline_id_selected
      FROM leads_pipelines
      WHERE active = true
      ORDER BY created_at
      LIMIT 1;
    END IF;
    
    IF pipeline_id_selected IS NULL THEN
      RETURN jsonb_build_object(
        'erro', 'Nenhum pipeline ativo encontrado',
        'pessoa_id', pessoa_id,
        'operacao_pessoa', operacao_pessoa
      );
    END IF;
    
    -- Buscar primeira etapa do pipeline
    SELECT id INTO stage_id_selected
    FROM leads_stages
    WHERE leads_pipelines_id = pipeline_id_selected
      AND active = true
    ORDER BY order_index
    LIMIT 1;
    
    IF stage_id_selected IS NULL THEN
      RETURN jsonb_build_object(
        'erro', 'Nenhuma etapa ativa encontrada no pipeline',
        'pessoa_id', pessoa_id,
        'operacao_pessoa', operacao_pessoa
      );
    END IF;
    
    IF modo_operacao = 'criar' THEN
      -- Modo criar: falha se lead já existe
      IF lead_id IS NOT NULL THEN
        RETURN jsonb_build_object(
          'erro', 'Pessoa já possui negócio existente',
          'pessoa_id', pessoa_id,
          'lead_id', lead_id,
          'operacao_pessoa', operacao_pessoa
        );
      END IF;
      
      -- Criar novo lead
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
        pipeline_id_selected,
        stage_id_selected,
        'Lead - ' || (pessoa_data->>'nome'),
        'em-andamento',
        now(),
        now()
      ) RETURNING id INTO lead_id;
      
      operacao_negocio = 'criado';
      
    ELSIF modo_operacao = 'criar-ou-atualizar' THEN
      IF lead_id IS NOT NULL THEN
        -- Atualizar lead existente
        UPDATE leads
        SET
          leads_pipelines_id = pipeline_id_selected,
          leads_stages_id = stage_id_selected,
          title = 'Lead - ' || (pessoa_data->>'nome'),
          updated_at = now()
        WHERE id = lead_id;
        
        operacao_negocio = 'atualizado';
      ELSE
        -- Criar novo lead
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
          pipeline_id_selected,
          stage_id_selected,
          'Lead - ' || (pessoa_data->>'nome'),
          'em-andamento',
          now(),
          now()
        ) RETURNING id INTO lead_id;
        
        operacao_negocio = 'criado';
      END IF;
    END IF;
  END IF;
  
  -- Retornar resultado
  RETURN jsonb_build_object(
    'pessoa_id', pessoa_id,
    'lead_id', lead_id,
    'operacao_pessoa', operacao_pessoa,
    'operacao_negocio', operacao_negocio
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'erro', SQLERRM,
      'operacao', 'falhou'
    );
END;
$function$;