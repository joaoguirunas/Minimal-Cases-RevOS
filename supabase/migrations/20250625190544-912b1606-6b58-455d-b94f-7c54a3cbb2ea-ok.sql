
-- Add status column to crm_empresas table
ALTER TABLE public.crm_empresas 
ADD COLUMN status text DEFAULT 'ativo';

-- Add a check constraint to ensure valid status values
ALTER TABLE public.crm_empresas 
ADD CONSTRAINT crm_empresas_status_check 
CHECK (status IN ('ativo', 'arquivado'));
