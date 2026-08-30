-- Add instruction_url column to project_tasks for Loom video embeds
ALTER TABLE project_tasks 
ADD COLUMN instruction_url TEXT;