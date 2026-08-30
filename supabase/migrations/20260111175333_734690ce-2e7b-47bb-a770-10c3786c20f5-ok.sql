-- Adiciona coluna para rastrear de qual conjunto de tarefas a tarefa foi criada
ALTER TABLE public.project_tasks 
ADD COLUMN source_task_set_id UUID REFERENCES public.process_task_sets(id) ON DELETE SET NULL;

-- Índice para performance nas consultas
CREATE INDEX idx_project_tasks_source_task_set ON public.project_tasks(source_task_set_id);