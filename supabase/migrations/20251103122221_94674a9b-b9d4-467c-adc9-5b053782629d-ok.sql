-- Atualizar trigger para remover referências a stage_id
CREATE OR REPLACE FUNCTION public.handle_ai_agents_steps_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_changed_by UUID;
  v_new_version INT;
  v_changelog JSONB;
  v_changes JSONB[];
BEGIN
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Obter usuário atual
  SELECT id INTO v_changed_by 
  FROM settings_users 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;

  -- Se não encontrou, tentar qualquer usuário ativo
  IF v_changed_by IS NULL THEN
    SELECT id INTO v_changed_by 
    FROM settings_users 
    WHERE auth_user_id IS NOT NULL 
    LIMIT 1;
  END IF;

  -- Obter próxima versão
  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_new_version
  FROM ai_agents_steps_history
  WHERE ai_agent_step_id = NEW.id;

  -- Criar array de mudanças (removido stage_id)
  v_changes := ARRAY[]::JSONB[];
  
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    v_changes := array_append(v_changes, jsonb_build_object('field', 'name', 'old', OLD.name, 'new', NEW.name));
  END IF;
  
  IF OLD.prompt IS DISTINCT FROM NEW.prompt THEN
    v_changes := array_append(v_changes, jsonb_build_object('field', 'prompt', 'old', OLD.prompt, 'new', NEW.prompt));
  END IF;
  
  IF OLD.control IS DISTINCT FROM NEW.control THEN
    v_changes := array_append(v_changes, jsonb_build_object('field', 'control', 'old', OLD.control, 'new', NEW.control));
  END IF;
  
  IF OLD.order_index IS DISTINCT FROM NEW.order_index THEN
    v_changes := array_append(v_changes, jsonb_build_object('field', 'order_index', 'old', OLD.order_index, 'new', NEW.order_index));
  END IF;
  
  IF OLD.active IS DISTINCT FROM NEW.active THEN
    v_changes := array_append(v_changes, jsonb_build_object('field', 'active', 'old', OLD.active, 'new', NEW.active));
  END IF;
  
  IF OLD.pipeline_id IS DISTINCT FROM NEW.pipeline_id THEN
    v_changes := array_append(v_changes, jsonb_build_object('field', 'pipeline_id', 'old', OLD.pipeline_id, 'new', NEW.pipeline_id));
  END IF;

  v_changelog := jsonb_build_object('changes', v_changes);

  -- Inserir no histórico se houver mudanças e usuário (removido stage_id)
  IF array_length(v_changes, 1) > 0 AND v_changed_by IS NOT NULL THEN
    INSERT INTO ai_agents_steps_history (
      ai_agent_step_id,
      version,
      changed_by,
      changed_at,
      name,
      pipeline_id,
      prompt,
      control,
      order_index,
      active,
      changelog
    ) VALUES (
      NEW.id,
      v_new_version,
      v_changed_by,
      NOW(),
      NEW.name,
      NEW.pipeline_id,
      NEW.prompt,
      NEW.control,
      NEW.order_index,
      NEW.active,
      v_changelog
    );
  END IF;

  RETURN NEW;
END;
$function$;