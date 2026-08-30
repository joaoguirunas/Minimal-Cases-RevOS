-- Define valor padrão '1' para a coluna control na tabela leads
ALTER TABLE public.leads 
ALTER COLUMN control SET DEFAULT '1';