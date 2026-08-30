
-- Corrigir a constraint de status_atendimento para aceitar 'fechado' em vez de 'encerrado'
ALTER TABLE public.crm_pessoas 
DROP CONSTRAINT IF EXISTS check_status_atendimento;

-- Recriar a constraint com os valores corretos que o código está usando
ALTER TABLE public.crm_pessoas 
ADD CONSTRAINT check_status_atendimento 
CHECK (status_atendimento IN ('aberto', 'fechado') OR status_atendimento IS NULL);

-- Comentário para documentar a mudança
COMMENT ON COLUMN crm_pessoas.status_atendimento IS 'Status do atendimento: aberto ou fechado (padrão: aberto)';
