-- Remove contact_attempts column from clients_people table
ALTER TABLE public.clients_people DROP COLUMN IF EXISTS contact_attempts;