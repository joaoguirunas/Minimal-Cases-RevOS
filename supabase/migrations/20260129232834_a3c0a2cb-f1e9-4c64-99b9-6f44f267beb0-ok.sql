-- Add contact_attempts column to clients_people table
ALTER TABLE clients_people 
ADD COLUMN IF NOT EXISTS contact_attempts integer DEFAULT 0;