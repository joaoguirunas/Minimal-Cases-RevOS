-- ============================================
-- LIMPEZA COMPLETA COM CASCADE
-- ============================================

-- 1. Remover TODOS os triggers da tabela ai_agents_steps
DROP TRIGGER IF EXISTS track_ai_agent_step_changes_trigger ON ai_agents_steps CASCADE;
DROP TRIGGER IF EXISTS track_ai_agent_stage_changes_trigger ON ai_agents_steps CASCADE;
DROP TRIGGER IF EXISTS ai_agents_steps_history_trigger ON ai_agents_steps CASCADE;
DROP TRIGGER IF EXISTS handle_ai_agents_steps_history_trigger ON ai_agents_steps CASCADE;

-- 2. Remover as funções antigas com CASCADE
DROP FUNCTION IF EXISTS track_ai_agent_step_changes() CASCADE;
DROP FUNCTION IF EXISTS track_ai_agent_stage_changes() CASCADE;
DROP FUNCTION IF EXISTS handle_ai_agents_steps_history() CASCADE;

-- ============================================
-- RECRIAR A FUNÇÃO CORRETA
-- ============================================
CREATE FUNCTION public.handle_ai_agents_steps_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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

  -- Criar array de mudanças
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
  
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    v_changes := array_append(v_changes, jsonb_build_object('field', 'stage_id', 'old', OLD.stage_id, 'new', NEW.stage_id));
  END IF;

  v_changelog := jsonb_build_object('changes', v_changes);

  -- Inserir no histórico se houver mudanças e usuário
  IF array_length(v_changes, 1) > 0 AND v_changed_by IS NOT NULL THEN
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
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- CRIAR O TRIGGER FINAL CORRETO
-- ============================================
CREATE TRIGGER ai_agents_steps_history_trigger
  AFTER UPDATE ON ai_agents_steps
  FOR EACH ROW
  EXECUTE FUNCTION handle_ai_agents_steps_history();