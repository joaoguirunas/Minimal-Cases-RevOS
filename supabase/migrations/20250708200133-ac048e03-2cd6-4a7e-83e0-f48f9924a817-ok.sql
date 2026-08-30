
-- Remover a coluna empresa_id da tabela crm_pessoas (agora usamos a tabela de associação)
ALTER TABLE public.crm_pessoas DROP COLUMN IF EXISTS empresa_id;

-- Verificar se existe alguma referência antiga e limpar se necessário
-- A associação agora é feita apenas através da tabela crm_pessoa_empresas
