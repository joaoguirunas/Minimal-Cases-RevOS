-- Criar função RPC para importação flexível de pessoas com negócios
CREATE OR REPLACE FUNCTION public.import_pessoa_with_flexible_lead(
  pessoa_data jsonb, 
  pipeline_id_param uuid, 
  tenant_id_param uuid,
  modo_operacao text DEFAULT 'criar'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  nova_pessoa_id uuid;
  pessoa_existente_id uuid;
  primeiro_stage_id uuid;
  novo_lead_id uuid;
  lead_existente_id uuid;
  result jsonb;
  operacao_pessoa text;
  operacao_negocio text;
BEGIN
  -- Validar entrada
  IF pessoa_data IS NULL OR tenant_id_param IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios não fornecidos';
  END IF;
  
  -- Validar modo de operação
  IF modo_operacao NOT IN ('nenhum', 'criar', 'criar-ou-atualizar') THEN
    RAISE EXCEPTION 'Modo de operação inválido: %', modo_operacao;
  END IF;
  
  -- Se modo é 'nenhum', só criar pessoa sem negócio
  IF modo_operacao = 'nenhum' THEN
    -- Verificar se pessoa já existe
    SELECT id INTO pessoa_existente_id
    FROM crm_pessoas 
    WHERE tenant_id = tenant_id_param 
    AND status != 'arquivado'
    AND (
      (whatsapp IS NOT NULL AND whatsapp = pessoa_data->>'whatsapp' AND pessoa_data->>'whatsapp' != '')
      OR (email IS NOT NULL AND email = pessoa_data->>'email' AND pessoa_data->>'email' != '')
    )
    LIMIT 1;
    
    IF pessoa_existente_id IS NOT NULL THEN
      -- Atualizar pessoa existente
      UPDATE crm_pessoas SET
        nome = COALESCE(pessoa_data->>'nome', nome),
        email = COALESCE(NULLIF(pessoa_data->>'email', ''), email),
        whatsapp = COALESCE(NULLIF(pessoa_data->>'whatsapp', ''), whatsapp),
        observacoes = COALESCE(NULLIF(pessoa_data->>'observacoes', ''), observacoes),
        score = CASE WHEN pessoa_data->>'score' != '' THEN (pessoa_data->>'score')::integer ELSE score END,
        renda = COALESCE(NULLIF(pessoa_data->>'renda', ''), renda),
        momento = COALESCE(NULLIF(pessoa_data->>'momento', ''), momento),
        objetivo = COALESCE(NULLIF(pessoa_data->>'objetivo', ''), objetivo),
        updated_at = now()
      WHERE id = pessoa_existente_id;
      
      nova_pessoa_id := pessoa_existente_id;
      operacao_pessoa := 'atualizada';
    ELSE
      -- Criar nova pessoa
      INSERT INTO crm_pessoas (
        nome, email, whatsapp, tenant_id, status, aceita_ligacao,
        observacoes, score, renda, momento, objetivo
      ) VALUES (
        pessoa_data->>'nome',
        NULLIF(pessoa_data->>'email', ''),
        NULLIF(pessoa_data->>'whatsapp', ''),
        tenant_id_param,
        COALESCE(pessoa_data->>'status', 'ativo'),
        COALESCE((pessoa_data->>'aceita_ligacao')::boolean, true),
        NULLIF(pessoa_data->>'observacoes', ''),
        CASE WHEN pessoa_data->>'score' != '' THEN (pessoa_data->>'score')::integer ELSE NULL END,
        NULLIF(pessoa_data->>'renda', ''),
        NULLIF(pessoa_data->>'momento', ''),
        NULLIF(pessoa_data->>'objetivo', '')
      ) RETURNING id INTO nova_pessoa_id;
      
      operacao_pessoa := 'criada';
    END IF;
    
    -- Retornar resultado sem negócio
    result := jsonb_build_object(
      'pessoa_id', nova_pessoa_id,
      'lead_id', null,
      'operacao_pessoa', operacao_pessoa,
      'operacao_negocio', 'nenhuma',
      'success', true
    );
    
    RETURN result;
  END IF;
  
  -- Para modos com negócio, validar pipeline
  IF pipeline_id_param IS NULL THEN
    RAISE EXCEPTION 'Pipeline é obrigatório para criar negócios';
  END IF;
  
  -- Buscar primeiro stage do pipeline
  SELECT id INTO primeiro_stage_id
  FROM crm_stages 
  WHERE pipeline_id = pipeline_id_param 
  AND tenant_id = tenant_id_param 
  AND ativo = true 
  ORDER BY ordem ASC 
  LIMIT 1;
  
  IF primeiro_stage_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline não possui etapas ativas';
  END IF;
  
  -- Verificar se pessoa já existe (por WhatsApp ou email)
  SELECT id INTO pessoa_existente_id
  FROM crm_pessoas 
  WHERE tenant_id = tenant_id_param 
  AND status != 'arquivado'
  AND (
    (whatsapp IS NOT NULL AND whatsapp = pessoa_data->>'whatsapp' AND pessoa_data->>'whatsapp' != '')
    OR (email IS NOT NULL AND email = pessoa_data->>'email' AND pessoa_data->>'email' != '')
  )
  LIMIT 1;
  
  -- Tratar pessoa existente baseado no modo
  IF pessoa_existente_id IS NOT NULL THEN
    IF modo_operacao = 'criar' THEN
      RAISE EXCEPTION 'Pessoa já existe no sistema (WhatsApp ou email duplicado)';
    ELSE -- modo 'criar-ou-atualizar'
      -- Atualizar pessoa existente
      UPDATE crm_pessoas SET
        nome = COALESCE(pessoa_data->>'nome', nome),
        email = COALESCE(NULLIF(pessoa_data->>'email', ''), email),
        whatsapp = COALESCE(NULLIF(pessoa_data->>'whatsapp', ''), whatsapp),
        observacoes = COALESCE(NULLIF(pessoa_data->>'observacoes', ''), observacoes),
        score = CASE WHEN pessoa_data->>'score' != '' THEN (pessoa_data->>'score')::integer ELSE score END,
        renda = COALESCE(NULLIF(pessoa_data->>'renda', ''), renda),
        momento = COALESCE(NULLIF(pessoa_data->>'momento', ''), momento),
        objetivo = COALESCE(NULLIF(pessoa_data->>'objetivo', ''), objetivo),
        updated_at = now()
      WHERE id = pessoa_existente_id;
      
      nova_pessoa_id := pessoa_existente_id;
      operacao_pessoa := 'atualizada';
    END IF;
  ELSE
    -- Criar nova pessoa
    INSERT INTO crm_pessoas (
      nome, email, whatsapp, tenant_id, status, aceita_ligacao,
      observacoes, score, renda, momento, objetivo
    ) VALUES (
      pessoa_data->>'nome',
      NULLIF(pessoa_data->>'email', ''),
      NULLIF(pessoa_data->>'whatsapp', ''),
      tenant_id_param,
      COALESCE(pessoa_data->>'status', 'ativo'),
      COALESCE((pessoa_data->>'aceita_ligacao')::boolean, true),
      NULLIF(pessoa_data->>'observacoes', ''),
      CASE WHEN pessoa_data->>'score' != '' THEN (pessoa_data->>'score')::integer ELSE NULL END,
      NULLIF(pessoa_data->>'renda', ''),
      NULLIF(pessoa_data->>'momento', ''),
      NULLIF(pessoa_data->>'objetivo', '')
    ) RETURNING id INTO nova_pessoa_id;
    
    operacao_pessoa := 'criada';
  END IF;
  
  -- Verificar se já existe negócio para esta pessoa no pipeline
  SELECT id INTO lead_existente_id
  FROM crm_leads 
  WHERE person_id = nova_pessoa_id 
  AND pipeline_id = pipeline_id_param 
  AND tenant_id = tenant_id_param
  AND status != 'perdido'
  LIMIT 1;
  
  IF lead_existente_id IS NOT NULL THEN
    IF modo_operacao = 'criar' THEN
      RAISE EXCEPTION 'Já existe negócio ativo para esta pessoa no pipeline selecionado';
    ELSE -- modo 'criar-ou-atualizar'
      -- Atualizar negócio existente
      UPDATE crm_leads SET
        updated_at = now(),
        data_ultima_interacao = now()
      WHERE id = lead_existente_id;
      
      novo_lead_id := lead_existente_id;
      operacao_negocio := 'atualizado';
    END IF;
  ELSE
    -- Criar novo negócio
    INSERT INTO crm_leads (
      person_id, pipeline_id, stage_id, tenant_id, status
    ) VALUES (
      nova_pessoa_id, pipeline_id_param, primeiro_stage_id, tenant_id_param, 'em-andamento'
    ) RETURNING id INTO novo_lead_id;
    
    operacao_negocio := 'criado';
  END IF;
  
  -- Retornar resultado completo
  result := jsonb_build_object(
    'pessoa_id', nova_pessoa_id,
    'lead_id', novo_lead_id,
    'operacao_pessoa', operacao_pessoa,
    'operacao_negocio', operacao_negocio,
    'success', true
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro para debug
    RAISE EXCEPTION 'Erro ao importar pessoa com negócio: %', SQLERRM;
END;
$function$;