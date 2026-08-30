
-- Adicionar campo para link do Google Meet na tabela de agendamentos
ALTER TABLE public.crm_agendamentos 
ADD COLUMN google_meet_link text;
