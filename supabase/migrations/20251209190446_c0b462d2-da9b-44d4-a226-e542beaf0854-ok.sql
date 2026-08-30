-- Remove estimated_hours column from project_tasks
ALTER TABLE public.project_tasks DROP COLUMN IF EXISTS estimated_hours;