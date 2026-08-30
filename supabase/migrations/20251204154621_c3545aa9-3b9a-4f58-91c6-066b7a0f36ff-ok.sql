-- Force schema cache refresh by recreating function
DROP FUNCTION IF EXISTS public.import_conversa(jsonb);

CREATE OR REPLACE FUNCTION public.import_conversa(conversa_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pessoa_id uuid;
  lead_id_param uuid;
  message_id integer;
  pipeline_id_param uuid;
  stage_id_param uuid;
  resultado jsonb;
BEGIN
  -- Find person by WhatsApp
  SELECT id INTO pessoa_id
  FROM clients_people
  WHERE whatsapp = conversa_data->>'pessoa_whatsapp'
  LIMIT 1;
  
  -- Create person if not found
  IF pessoa_id IS NULL THEN
    INSERT INTO clients_people (
      name, whatsapp, status, created_at, updated_at
    ) VALUES (
      COALESCE(conversa_data->>'pessoa_nome', 'Cliente ' || (conversa_data->>'pessoa_whatsapp')),
      conversa_data->>'pessoa_whatsapp', 'ativo', now(), now()
    ) RETURNING id INTO pessoa_id;
  END IF;
  
  -- Find existing lead for this person
  SELECT id INTO lead_id_param
  FROM leads
  WHERE people_id = pessoa_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Create lead if not found
  IF lead_id_param IS NULL THEN
    IF conversa_data->>'pipeline_id' IS NOT NULL THEN
      pipeline_id_param = (conversa_data->>'pipeline_id')::uuid;
    ELSE
      SELECT id INTO pipeline_id_param
      FROM leads_pipelines
      WHERE active = true
      ORDER BY created_at
      LIMIT 1;
    END IF;
    
    IF pipeline_id_param IS NOT NULL THEN
      SELECT id INTO stage_id_param
      FROM leads_stages
      WHERE leads_pipelines_id = pipeline_id_param AND active = true
      ORDER BY order_index
      LIMIT 1;
      
      IF stage_id_param IS NOT NULL THEN
        INSERT INTO leads (
          people_id, leads_pipelines_id, leads_stages_id,
          title, status, created_at, updated_at
        ) VALUES (
          pessoa_id, pipeline_id_param, stage_id_param,
          'Lead - ' || COALESCE(conversa_data->>'pessoa_nome', conversa_data->>'pessoa_whatsapp'),
          'em-andamento', now(), now()
        ) RETURNING id INTO lead_id_param;
      END IF;
    END IF;
  END IF;
  
  -- Insert the message
  INSERT INTO messages (
    people_id, leads_id, content, from_contact,
    message_type, channel, status, created_at, updated_at
  ) VALUES (
    pessoa_id, lead_id_param,
    conversa_data->>'conteudo',
    conversa_data->>'from_contact',
    COALESCE(conversa_data->>'tipo_mensagem', 'texto'),
    COALESCE(conversa_data->>'canal', 'whatsapp'),
    'received',
    now(), now()
  ) RETURNING id INTO message_id;
  
  resultado = jsonb_build_object(
    'message_id', message_id,
    'lead_id', lead_id_param,
    'pessoa_id', pessoa_id,
    'operacao', 'criado'
  );
  
  RETURN resultado;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('erro', SQLERRM, 'operacao', 'falhou');
END;
$function$;

-- Also notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';