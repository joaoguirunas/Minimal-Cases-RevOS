-- Tornar leads_id nullable para permitir bloqueios de agenda sem lead associado
ALTER TABLE meetings 
ALTER COLUMN leads_id DROP NOT NULL;