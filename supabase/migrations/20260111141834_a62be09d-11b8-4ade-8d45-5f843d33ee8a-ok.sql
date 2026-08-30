-- Primeiro deletar as subtarefas associadas aos modelos
DELETE FROM public.process_subtask_templates
WHERE task_template_id IN (
  SELECT id FROM public.process_task_templates
);

-- Depois deletar todos os modelos de tarefas
DELETE FROM public.process_task_templates;