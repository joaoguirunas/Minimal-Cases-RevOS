
-- Add datetime_bloqueia_ia column to crm_leads table
ALTER TABLE public.crm_leads 
ADD COLUMN datetime_bloqueia_ia timestamp with time zone;
