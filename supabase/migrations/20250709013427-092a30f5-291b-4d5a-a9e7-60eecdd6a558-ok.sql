
-- Adicionar campo atendimento_ia na tabela crm_pessoas
ALTER TABLE public.crm_pessoas 
ADD COLUMN atendimento_ia boolean DEFAULT true;

-- Comentário: Este campo controlará se a IA está ativa ou não para cada pessoa
