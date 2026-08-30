-- Ajustar configurações da tabela crm_pessoas para controle de IA e status de atendimento

-- 1. Atualizar todos os registros com atendimento_ia = false para true
UPDATE public.crm_pessoas 
SET atendimento_ia = true 
WHERE atendimento_ia = false OR atendimento_ia IS NULL;

-- 2. Alterar o padrão do campo atendimento_ia para true
ALTER TABLE public.crm_pessoas 
ALTER COLUMN atendimento_ia SET DEFAULT true;

-- 3. Primeiro, atualizar registros com 'fechado' para 'encerrado'
UPDATE public.crm_pessoas 
SET status_atendimento = 'encerrado' 
WHERE status_atendimento = 'fechado';

-- 4. Atualizar registros com status inválidos ou NULL para 'aberto'
UPDATE public.crm_pessoas 
SET status_atendimento = 'aberto' 
WHERE status_atendimento NOT IN ('aberto', 'encerrado') OR status_atendimento IS NULL;

-- 5. Remover constraint antiga se existir
ALTER TABLE public.crm_pessoas 
DROP CONSTRAINT IF EXISTS check_status_atendimento;

-- 6. Criar nova constraint com os valores corretos
ALTER TABLE public.crm_pessoas 
ADD CONSTRAINT check_status_atendimento 
CHECK (status_atendimento IN ('aberto', 'encerrado') OR status_atendimento IS NULL);

-- 7. Alterar o padrão do campo status_atendimento para 'aberto'
ALTER TABLE public.crm_pessoas 
ALTER COLUMN status_atendimento SET DEFAULT 'aberto';

-- Comentários para documentar as mudanças
COMMENT ON COLUMN crm_pessoas.atendimento_ia IS 'Controle se a IA está ativa para esta pessoa (padrão: true)';
COMMENT ON COLUMN crm_pessoas.status_atendimento IS 'Status do atendimento: aberto ou encerrado (padrão: aberto)';