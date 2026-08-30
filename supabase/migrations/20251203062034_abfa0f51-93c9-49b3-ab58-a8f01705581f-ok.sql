-- Make project_id nullable on project_tasks table
ALTER TABLE public.project_tasks
ALTER COLUMN project_id DROP NOT NULL;