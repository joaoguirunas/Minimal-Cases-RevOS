-- Alterar o valor padrão de ai_enabled para true
ALTER TABLE public.clients_people 
ALTER COLUMN ai_enabled SET DEFAULT true;