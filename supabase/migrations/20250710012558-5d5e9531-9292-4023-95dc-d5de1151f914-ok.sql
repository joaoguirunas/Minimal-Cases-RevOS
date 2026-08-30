
-- Atualizar a constraint de status_atendimento para incluir os valores corretos
ALTER TABLE public.crm_pessoas DROP CONSTRAINT IF EXISTS check_status_atendimento;

-- Recriar a constraint com os valores corretos
ALTER TABLE public.crm_pessoas 
ADD CONSTRAINT check_status_atendimento 
CHECK (status_atendimento IN ('em-andamento', 'fechado'));

-- Atualizar registros existentes que possam ter 'aberto' para 'em-andamento'
UPDATE public.crm_pessoas 
SET status_atendimento = 'em-andamento' 
WHERE status_atendimento = 'aberto';
