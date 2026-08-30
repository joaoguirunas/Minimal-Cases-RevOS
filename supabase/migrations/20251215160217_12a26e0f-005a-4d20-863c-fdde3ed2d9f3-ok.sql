-- Add knowledge fields to project_job_functions
ALTER TABLE project_job_functions 
ADD COLUMN IF NOT EXISTS required_knowledge text,
ADD COLUMN IF NOT EXISTS expected_knowledge text,
ADD COLUMN IF NOT EXISTS differential_knowledge text;