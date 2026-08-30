-- Tornar task_set_id opcional para permitir tarefas modelo independentes
ALTER TABLE public.process_task_templates 
ALTER COLUMN task_set_id DROP NOT NULL;

-- Adicionar coluna category_id para categorizar tarefas modelo independentes
ALTER TABLE public.process_task_templates 
ADD COLUMN category_id uuid REFERENCES public.process_task_set_categories(id) ON DELETE SET NULL;

-- Adicionar flag para identificar se é um modelo master
ALTER TABLE public.process_task_templates 
ADD COLUMN is_template boolean DEFAULT false;

-- Criar índice para otimizar busca de modelos
CREATE INDEX idx_task_templates_is_template ON public.process_task_templates(is_template) WHERE is_template = true;

-- Criar índice para otimizar busca por categoria
CREATE INDEX idx_task_templates_category ON public.process_task_templates(category_id) WHERE category_id IS NOT NULL;