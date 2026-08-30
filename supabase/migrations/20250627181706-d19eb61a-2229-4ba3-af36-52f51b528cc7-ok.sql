
-- Adicionar coluna de minutos à tabela crm_stage_followups
ALTER TABLE public.crm_stage_followups 
ADD COLUMN IF NOT EXISTS minutos integer NOT NULL DEFAULT 0;
