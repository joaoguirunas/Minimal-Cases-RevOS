
-- Atualizar a tabela crm_messages para suportar os novos tipos de mensagens
ALTER TABLE public.crm_messages 
ADD COLUMN tipo_mensagem TEXT DEFAULT 'texto' CHECK (tipo_mensagem IN ('texto', 'audio', 'chamada')),
ADD COLUMN audio_url TEXT,
ADD COLUMN transcricao TEXT,
ADD COLUMN duracao_audio INTEGER; -- em segundos

-- Atualizar o campo from_message para usar valores padronizados
ALTER TABLE public.crm_messages 
DROP CONSTRAINT IF EXISTS crm_messages_from_message_check,
ADD CONSTRAINT crm_messages_from_message_check 
CHECK (from_message IN ('agente_ia', 'follow_up', 'humano', 'cliente'));

-- Criar índices para otimização
CREATE INDEX IF NOT EXISTS idx_crm_messages_tipo_mensagem ON public.crm_messages(tipo_mensagem);
CREATE INDEX IF NOT EXISTS idx_crm_messages_from_message ON public.crm_messages(from_message);
