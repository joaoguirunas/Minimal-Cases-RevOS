-- Atualiza todas as tarefas que pertencem a um conjunto para serem também templates
UPDATE process_task_templates
SET is_template = true
WHERE task_set_id IS NOT NULL
  AND (is_template IS NULL OR is_template = false);