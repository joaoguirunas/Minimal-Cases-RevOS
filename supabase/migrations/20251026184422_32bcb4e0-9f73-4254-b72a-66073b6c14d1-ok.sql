-- Verificar e corrigir triggers que fazem referência à tabela antiga

-- Primeiro, vamos dropar triggers antigos se existirem
DROP TRIGGER IF EXISTS ai_agents_stages_history_trigger ON ai_agents_steps;
DROP FUNCTION IF EXISTS handle_ai_agents_stages_history();

-- Recriar a função de histórico com o nome correto da tabela
CREATE OR REPLACE FUNCTION handle_ai_agents_steps_history()
RETURNS TRIGGER AS $$
DECLARE
  v_changed_by UUID;
  v_new_version INT;
  v_changelog JSONB;
  v_changes JSONB[];
BEGIN
  -- Get the current user from the JWT
  v_changed_by := auth.uid();
  
  -- Se não houver usuário autenticado, usar o valor do NEW.ai_agent_id como fallback
  IF v_changed_by IS NULL THEN
    SELECT user_id INTO v_changed_by 
    FROM ai_agents 
    WHERE id = NEW.ai_agent_id 
    LIMIT 1;
  END IF;

  -- Get the next version number
  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_new_version
  FROM ai_agents_steps_history
  WHERE ai_agent_step_id = NEW.id;

  -- Build changelog comparing OLD and NEW
  v_changes := ARRAY[]::JSONB[];
  
  IF TG_OP = 'UPDATE' THEN
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
    
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      v_changes := array_append(v_changes, jsonb_build_object('field', 'stage_id', 'old', OLD.stage_id, 'new', NEW.stage_id));
    END IF;
  END IF;

  v_changelog := jsonb_build_object('changes', v_changes);

  -- Insert into history table
  INSERT INTO ai_agents_steps_history (
    ai_agent_step_id,
    version,
    changed_by,
    changed_at,
    name,
    pipeline_id,
    stage_id,
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
    NEW.stage_id,
    NEW.prompt,
    NEW.control,
    NEW.order_index,
    NEW.active,
    v_changelog
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar o trigger correto
DROP TRIGGER IF EXISTS ai_agents_steps_history_trigger ON ai_agents_steps;
CREATE TRIGGER ai_agents_steps_history_trigger
  AFTER INSERT OR UPDATE ON ai_agents_steps
  FOR EACH ROW
  EXECUTE FUNCTION handle_ai_agents_steps_history();