-- =============================================
-- MÓDULO DE PROCESSOS - CONFIGURAÇÕES DE PROJETOS
-- =============================================

-- 1. Categorias dos Conjuntos de Tarefas
CREATE TABLE public.process_task_set_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Conjuntos de Tarefas (Task Sets)
CREATE TABLE public.process_task_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.process_task_set_categories(id) ON DELETE SET NULL,
  color TEXT,
  estimated_time_minutes INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tarefas Modelo (Task Templates)
CREATE TABLE public.process_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_set_id UUID NOT NULL REFERENCES public.process_task_sets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  instruction_url TEXT,
  priority TEXT DEFAULT 'medium',
  job_function_id UUID REFERENCES public.project_job_functions(id) ON DELETE SET NULL,
  estimated_time_minutes INTEGER DEFAULT 0,
  tags TEXT[],
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Subtarefas Modelo (Subtask Templates)
CREATE TABLE public.process_subtask_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_template_id UUID NOT NULL REFERENCES public.process_task_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  estimated_time_minutes INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Processos
CREATE TABLE public.processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Passos do Processo (conexão visual entre conjuntos)
CREATE TABLE public.process_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  task_set_id UUID NOT NULL REFERENCES public.process_task_sets(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.process_task_set_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_task_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_subtask_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_steps ENABLE ROW LEVEL SECURITY;

-- Categories policies
CREATE POLICY "Allow all access to process_task_set_categories" ON public.process_task_set_categories
  FOR ALL USING (true) WITH CHECK (true);

-- Task Sets policies
CREATE POLICY "Allow all access to process_task_sets" ON public.process_task_sets
  FOR ALL USING (true) WITH CHECK (true);

-- Task Templates policies
CREATE POLICY "Allow all access to process_task_templates" ON public.process_task_templates
  FOR ALL USING (true) WITH CHECK (true);

-- Subtask Templates policies
CREATE POLICY "Allow all access to process_subtask_templates" ON public.process_subtask_templates
  FOR ALL USING (true) WITH CHECK (true);

-- Processes policies
CREATE POLICY "Allow all access to processes" ON public.processes
  FOR ALL USING (true) WITH CHECK (true);

-- Process Steps policies
CREATE POLICY "Allow all access to process_steps" ON public.process_steps
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_process_task_sets_category ON public.process_task_sets(category_id);
CREATE INDEX idx_process_task_templates_task_set ON public.process_task_templates(task_set_id);
CREATE INDEX idx_process_task_templates_job_function ON public.process_task_templates(job_function_id);
CREATE INDEX idx_process_subtask_templates_task_template ON public.process_subtask_templates(task_template_id);
CREATE INDEX idx_process_steps_process ON public.process_steps(process_id);
CREATE INDEX idx_process_steps_task_set ON public.process_steps(task_set_id);

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================

CREATE TRIGGER update_process_task_set_categories_updated_at
  BEFORE UPDATE ON public.process_task_set_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_process_task_sets_updated_at
  BEFORE UPDATE ON public.process_task_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_process_task_templates_updated_at
  BEFORE UPDATE ON public.process_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_process_subtask_templates_updated_at
  BEFORE UPDATE ON public.process_subtask_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_processes_updated_at
  BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- INSERT DEFAULT CATEGORIES
-- =============================================

INSERT INTO public.process_task_set_categories (name, description, color, sort_order) VALUES
  ('Comercial', 'Processos relacionados a vendas e atendimento ao cliente', '#3B82F6', 1),
  ('Gestão', 'Processos de gestão de projetos e equipes', '#8B5CF6', 2),
  ('Automações', 'Processos de configuração e automação de sistemas', '#10B981', 3),
  ('Engenharia de Prompt', 'Processos de criação e otimização de prompts de IA', '#F59E0B', 4);