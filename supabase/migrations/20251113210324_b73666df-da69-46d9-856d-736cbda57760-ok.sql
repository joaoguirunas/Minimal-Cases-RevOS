-- Corrigir função para usar a tabela clients_people ao invés de pessoas
DROP FUNCTION IF EXISTS public.import_pessoa_with_flexible_lead(TEXT, JSONB, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.import_pessoa_with_flexible_lead(
  modo_operacao TEXT,
  pessoa_data JSONB,
  pipeline_id_param UUID DEFAULT NULL,
  tenant_id_param TEXT DEFAULT 'single-tenant'
)
RETURNS JSONB
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
  -- Extrair dados essenciais
  v_whatsapp := pessoa_data->>'whatsapp';
  v_email := pessoa_data->>'email';
  v_nome := pessoa_data->>'nome';

  -- Validar dados obrigatórios
  IF v_nome IS NULL OR v_nome = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nome é obrigatório'
    );
  END IF;

  IF v_whatsapp IS NULL OR v_whatsapp = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'WhatsApp é obrigatório'
    );
  END IF;

  -- Verificar se pessoa já existe por WhatsApp na tabela clients_people
  SELECT id INTO v_existing_pessoa_id
  FROM public.clients_people
  WHERE whatsapp = v_whatsapp
  LIMIT 1;

  -- Se pessoa existe, retornar ou atualizar
  IF v_existing_pessoa_id IS NOT NULL THEN
    v_pessoa_id := v_existing_pessoa_id;
    
    -- Atualizar dados da pessoa existente
    UPDATE public.clients_people
    SET
      name = COALESCE(v_nome, name),
      email = COALESCE(v_email, email),
      document = COALESCE(pessoa_data->>'documento', document),
      notes = COALESCE(pessoa_data->>'observacoes', notes),
      updated_at = NOW()
    WHERE id = v_pessoa_id;
  ELSE
    -- Inserir nova pessoa na tabela clients_people
    INSERT INTO public.clients_people (
      name,
      email,
      whatsapp,
      document,
      notes,
      accepts_calls,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_nome,
      v_email,
      v_whatsapp,
      pessoa_data->>'documento',
      pessoa_data->>'observacoes',
      COALESCE((pessoa_data->>'aceita_ligacao')::boolean, true),
      COALESCE(pessoa_data->>'status', 'ativo'),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_pessoa_id;
  END IF;

  -- Criar lead se modo_operacao = 'criar' e pipeline_id foi fornecido
  IF modo_operacao = 'criar' AND pipeline_id_param IS NOT NULL THEN
    -- Buscar primeira etapa do pipeline
    SELECT id INTO v_first_stage_id
    FROM public.leads_stages
    WHERE leads_pipelines_id = pipeline_id_param
      AND active = true
    ORDER BY order_index ASC
    LIMIT 1;

    IF v_first_stage_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'pessoa_id', v_pessoa_id,
        'error', 'Pipeline não possui etapas ativas'
      );
    END IF;

    -- Inserir lead com people_id
    INSERT INTO public.leads (
      title,
      people_id,
      leads_pipelines_id,
      leads_stages_id,
      status,
      created_at,
      updated_at
    ) VALUES (
      'Lead - ' || v_nome,
      v_pessoa_id,
      pipeline_id_param,
      v_first_stage_id,
      'em-andamento',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_lead_id;
  END IF;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'pessoa_id', v_pessoa_id,
    'lead_id', v_lead_id,
    'is_new', (v_existing_pessoa_id IS NULL)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;