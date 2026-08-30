-- Alterar colunas de qualificação de integer para text
ALTER TABLE public.clients_people 
ALTER COLUMN q2_lead_volume_month TYPE text USING q2_lead_volume_month::text;

ALTER TABLE public.clients_people 
ALTER COLUMN q3_team_size TYPE text USING q3_team_size::text;

ALTER TABLE public.clients_people 
ALTER COLUMN q21_interest_level TYPE text USING q21_interest_level::text;

ALTER TABLE public.clients_people 
ALTER COLUMN q22_close_probability TYPE text USING q22_close_probability::text;