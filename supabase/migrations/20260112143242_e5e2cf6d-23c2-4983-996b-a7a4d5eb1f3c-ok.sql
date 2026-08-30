-- ============================================
-- SECURITY FIX: Restrict webhook_logs RLS and add authorization to functions
-- This migration fixes:
-- 1. webhook_logs_exposure - Restrict access to admins only
-- 2. definer_missing_authz - Add authorization checks to SECURITY DEFINER functions
-- ============================================

-- ===========================================
-- FIX 1: Restrict webhook_logs access to admins only
-- ===========================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "authenticated_read" ON public.webhook_logs;
DROP POLICY IF EXISTS "authenticated_write" ON public.webhook_logs;
DROP POLICY IF EXISTS "admins_read_webhook_logs" ON public.webhook_logs;
DROP POLICY IF EXISTS "admins_write_webhook_logs" ON public.webhook_logs;

-- Only admins/gestors can read webhook logs
CREATE POLICY "admins_read_webhook_logs" ON public.webhook_logs
FOR SELECT TO authenticated
USING (is_admin_or_gestor());

-- Only admins/gestors can insert webhook logs
CREATE POLICY "admins_write_webhook_logs" ON public.webhook_logs
FOR INSERT TO authenticated
WITH CHECK (is_admin_or_gestor());

-- ===========================================
-- FIX 2: Add authorization to import_pessoa_with_flexible_lead
-- ===========================================

CREATE OR REPLACE FUNCTION public.import_pessoa_with_flexible_lead(
  modo_operacao text, 
  pessoa_data jsonb, 
  pipeline_id_param uuid DEFAULT NULL::uuid, 
  tenant_id_param text DEFAULT 'single-tenant'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pessoa_id UUID;
  v_lead_id UUID;
  v_first_stage_id UUID;
  v_whatsapp TEXT;
  v_email TEXT;
  v_nome TEXT;
  v_existing_pessoa_id UUID;
BEGIN
  -- SECURITY CHECK: Verify user is authenticated and active
  IF NOT EXISTS (
    SELECT 1 FROM public.settings_users
    WHERE auth_user_id = auth.uid()
    AND active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado: usuário não autorizado');
  END IF;

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
$function$;

-- ===========================================
-- FIX 3: Add authorization to import_conversa
-- ===========================================

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
  -- SECURITY CHECK: Verify user is authenticated and active
  IF NOT EXISTS (
    SELECT 1 FROM public.settings_users
    WHERE auth_user_id = auth.uid()
    AND active = true
  ) THEN
    RETURN jsonb_build_object('erro', 'Acesso negado: usuário não autorizado', 'operacao', 'falhou');
  END IF;

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
  
  -- Insert the message with valid status
  INSERT INTO messages (
    people_id, leads_id, content, from_contact,
    message_type, channel, status, created_at, updated_at
  ) VALUES (
    pessoa_id, lead_id_param,
    conversa_data->>'conteudo',
    conversa_data->>'from_contact',
    COALESCE(conversa_data->>'tipo_mensagem', 'texto'),
    COALESCE(conversa_data->>'canal', 'whatsapp'),
    'pendente',
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

-- ===========================================
-- FIX 4: Add authorization to import_agendamento
-- ===========================================

CREATE OR REPLACE FUNCTION public.import_agendamento(meeting_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  -- SECURITY CHECK: Verify user is authenticated and active
  IF NOT EXISTS (
    SELECT 1 FROM public.settings_users
    WHERE auth_user_id = auth.uid()
    AND active = true
  ) THEN
    RETURN jsonb_build_object('erro', 'Acesso negado: usuário não autorizado', 'operacao', 'falhou');
  END IF;

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
$function$;