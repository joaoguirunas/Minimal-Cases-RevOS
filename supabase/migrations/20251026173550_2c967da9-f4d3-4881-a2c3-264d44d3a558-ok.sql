-- =====================================================
-- REFATORAÇÃO COMPLETA: Histórico de Stages + Correções
-- =====================================================

-- 1. CRIAR TABELA DE HISTÓRICO DE STAGES
CREATE TABLE IF NOT EXISTS public.ai_agents_stages_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_stage_id uuid NOT NULL REFERENCES public.ai_agents_stages(id) ON DELETE CASCADE,
  version integer NOT NULL,
  changed_by uuid REFERENCES public.settings_users(id),
  changed_at timestamp with time zone DEFAULT now() NOT NULL,
  
  -- Snapshot dos dados
  name text,
  pipeline_id uuid,
  stage_id uuid,
  prompt text,
  control text,
  order_index integer,
  active boolean,
  
  -- Changelog estruturado
  changelog jsonb,
  
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_stages_history_stage_id ON public.ai_agents_stages_history(ai_agent_stage_id);
CREATE INDEX IF NOT EXISTS idx_stages_history_version ON public.ai_agents_stages_history(ai_agent_stage_id, version DESC);

-- RLS para histórico
ALTER TABLE public.ai_agents_stages_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_agents_stages_history_access_policy" ON public.ai_agents_stages_history;
CREATE POLICY "ai_agents_stages_history_access_policy"
ON public.ai_agents_stages_history
FOR ALL
USING (true);

-- 2. CRIAR TRIGGER PARA HISTÓRICO AUTOMÁTICO DE STAGES
CREATE OR REPLACE FUNCTION public.track_ai_agent_stage_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_version integer;
  current_user_id uuid;
  change_log jsonb;
  changes_array jsonb[];
BEGIN
  -- Apenas em UPDATEs
  IF TG_OP = 'UPDATE' THEN
    -- Buscar próxima versão
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
    FROM public.ai_agents_stages_history
    WHERE ai_agent_stage_id = NEW.id;
    
    -- Buscar usuário atual
    SELECT id INTO current_user_id
    FROM public.settings_users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
    
    -- Criar array de mudanças
    changes_array := ARRAY[]::jsonb[];
    
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      changes_array := changes_array || jsonb_build_object('field', 'name', 'old', OLD.name, 'new', NEW.name);
    END IF;
    
    IF OLD.prompt IS DISTINCT FROM NEW.prompt THEN
      changes_array := changes_array || jsonb_build_object('field', 'prompt', 'old', OLD.prompt, 'new', NEW.prompt);
    END IF;
    
    IF OLD.pipeline_id IS DISTINCT FROM NEW.pipeline_id THEN
      changes_array := changes_array || jsonb_build_object('field', 'pipeline_id', 'old', OLD.pipeline_id::text, 'new', NEW.pipeline_id::text);
    END IF;
    
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      changes_array := changes_array || jsonb_build_object('field', 'stage_id', 'old', OLD.stage_id::text, 'new', NEW.stage_id::text);
    END IF;
    
    IF OLD.control IS DISTINCT FROM NEW.control THEN
      changes_array := changes_array || jsonb_build_object('field', 'control', 'old', OLD.control, 'new', NEW.control);
    END IF;
    
    IF OLD.order_index IS DISTINCT FROM NEW.order_index THEN
      changes_array := changes_array || jsonb_build_object('field', 'order_index', 'old', OLD.order_index, 'new', NEW.order_index);
    END IF;
    
    IF OLD.active IS DISTINCT FROM NEW.active THEN
      changes_array := changes_array || jsonb_build_object('field', 'active', 'old', OLD.active, 'new', NEW.active);
    END IF;
    
    -- Criar changelog apenas se houver mudanças
    IF array_length(changes_array, 1) > 0 THEN
      change_log := jsonb_build_object('changes', to_jsonb(changes_array));
      
      INSERT INTO public.ai_agents_stages_history (
        ai_agent_stage_id,
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
        next_version,
        current_user_id,
        NOW(),
        NEW.name,
        NEW.pipeline_id,
        NEW.stage_id,
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

-- Aplicar trigger
DROP TRIGGER IF EXISTS track_stage_changes ON public.ai_agents_stages;
CREATE TRIGGER track_stage_changes
  AFTER UPDATE ON public.ai_agents_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.track_ai_agent_stage_changes();

-- 3. CORRIGIR RLS EM ai_agents_stages
DROP POLICY IF EXISTS "ai_agents_stages_access_policy" ON public.ai_agents_stages;

CREATE POLICY "ai_agents_stages_full_access"
ON public.ai_agents_stages
FOR ALL
USING (true)
WITH CHECK (true);