-- fwup26: colunas ausentes em messages para tenants criados a partir do baseline
-- O baseline (20260312) criou messages sem estas colunas — adicionadas aqui de
-- forma idempotente para não quebrar em tenants que já as têm.

-- source_type: origem da mensagem (inbound, manual, ai_agent, campaign, form, followup, appointment_reminder)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS source_type text;

-- Remover constraint antiga se existir (pode ter valor mais restrito) e recriar
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_source_type_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_source_type_check CHECK (source_type IN (
    'inbound',
    'manual',
    'ai_agent',
    'campaign',
    'form',
    'followup',
    'appointment_reminder'
  ));

-- wa_message_id: ID da mensagem no lado da Meta/WhatsApp
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS wa_message_id text;

-- wa_phone_number_id: número WhatsApp Business que recebeu/enviou
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text;

-- media_metadata: metadados de mídia (imagem, áudio, documento)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_metadata jsonb;

-- metadata: payload JSON genérico (origem, canal, wa_from, etc.)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Índice para dedup de mensagens por wa_message_id
CREATE INDEX IF NOT EXISTS idx_messages_wa_message_id
  ON public.messages (wa_message_id)
  WHERE wa_message_id IS NOT NULL;
