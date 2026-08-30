-- Renomear tabela ai_agents_stages para ai_agents_steps
ALTER TABLE public.ai_agents_stages RENAME TO ai_agents_steps;

-- Renomear tabela ai_agents_stages_history para ai_agents_steps_history
ALTER TABLE public.ai_agents_stages_history RENAME TO ai_agents_steps_history;

-- Renomear coluna ai_agent_stage_id para ai_agent_step_id na tabela de histórico
ALTER TABLE public.ai_agents_steps_history 
RENAME COLUMN ai_agent_stage_id TO ai_agent_step_id;

-- Remover trigger antigo
DROP TRIGGER IF EXISTS track_ai_agent_stage_changes ON public.ai_agents_steps;

-- Criar nova função de trigger com nome atualizado
CREATE OR REPLACE FUNCTION public.track_ai_agent_step_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_version integer;
  current_user_id uuid;
  change_log jsonb;
  changes_array jsonb[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
    FROM public.ai_agents_steps_history
    WHERE ai_agent_step_id = NEW.id;
    
    SELECT id INTO current_user_id
    FROM public.settings_users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
    
    changes_array := ARRAY[]::jsonb[];
    
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      changes_array := changes_array || jsonb_build_object('field', 'name', 'old', OLD.name, 'new', NEW.name);
    END IF;
    
    IF OLD.prompt IS DISTINCT FROM NEW.prompt THEN
      changes_array := changes_array || jsonb_build_object('field', 'prompt', 'old', OLD.prompt, 'new', NEW.prompt);
    END IF;
    
    IF OLD.control IS DISTINCT FROM NEW.control THEN
      changes_array := changes_array || jsonb_build_object('field', 'control', 'old', OLD.control, 'new', OLD.control);
    END IF;
    
    IF OLD.order_index IS DISTINCT FROM NEW.order_index THEN
      changes_array := changes_array || jsonb_build_object('field', 'order_index', 'old', OLD.order_index, 'new', NEW.order_index);
    END IF;
    
    IF OLD.active IS DISTINCT FROM NEW.active THEN
      changes_array := changes_array || jsonb_build_object('field', 'active', 'old', OLD.active, 'new', NEW.active);
    END IF;
    
    IF array_length(changes_array, 1) > 0 THEN
      change_log := jsonb_build_object('changes', to_jsonb(changes_array));
      
      INSERT INTO public.ai_agents_steps_history (
        ai_agent_step_id,
        version,
        changed_by,
        changed_at,
        name,
        prompt,
        control,
        order_index,
        active,
        changelog
      ) VALUES (
        NEW.id,
        next_version,
        current_user_id,
        NOW(),
        NEW.name,
        NEW.prompt,
        NEW.control,
        NEW.order_index,
        NEW.active,
        change_log
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar novo trigger
CREATE TRIGGER track_ai_agent_step_changes
  AFTER UPDATE ON public.ai_agents_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.track_ai_agent_step_changes();

-- Atualizar comentários
COMMENT ON TABLE public.ai_agents_steps IS 'Passos/prompts internos do agente (não relacionados a etapas do pipeline)';
COMMENT ON TABLE public.ai_agents_steps_history IS 'Histórico de alterações dos passos dos agentes de IA';