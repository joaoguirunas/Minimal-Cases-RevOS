-- Renomear colunas de estimated_time_minutes para time_minutes

-- process_task_sets
ALTER TABLE process_task_sets RENAME COLUMN estimated_time_minutes TO time_minutes;

-- process_task_templates  
ALTER TABLE process_task_templates RENAME COLUMN estimated_time_minutes TO time_minutes;

-- process_subtask_templates
ALTER TABLE process_subtask_templates RENAME COLUMN estimated_time_minutes TO time_minutes;