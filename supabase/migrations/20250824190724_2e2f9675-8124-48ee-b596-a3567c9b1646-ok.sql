-- Add convidados field to crm_agendamentos table
ALTER TABLE crm_agendamentos 
ADD COLUMN convidados uuid[] DEFAULT NULL;