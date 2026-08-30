
-- Verificar se existe uma constraint que está impedindo a atualização do status_atendimento
-- e remover se necessário, depois recriar corretamente

-- Primeiro, vamos ver se há alguma constraint problemática
ALTER TABLE public.crm_pessoas DROP CONSTRAINT IF EXISTS check_status_atendimento;

-- Recriar a constraint corretamente se necessário
ALTER TABLE public.crm_pessoas 
ADD CONSTRAINT check_status_atendimento 
CHECK (status_atendimento IN ('aberto', 'fechado'));

-- Verificar se a coluna atendimento_ia existe e tem o tipo correto
-- (Já foi criada na migração anterior, mas vamos garantir)
