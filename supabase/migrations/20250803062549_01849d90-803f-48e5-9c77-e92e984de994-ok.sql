-- Remover constraint UNIQUE que impede múltiplos leads por pessoa no mesmo pipeline
ALTER TABLE public.crm_leads 
DROP CONSTRAINT IF EXISTS crm_leads_person_id_pipeline_id_key;