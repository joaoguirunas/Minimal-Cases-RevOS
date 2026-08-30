-- Migration: Expand messages constraints for Instagram omnichannel interactions
-- Adds: instagram, telefone to channel; comentario, story_reply, story_mention, chamada to message_type

-- Expand channel constraint
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_channel_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_channel_check
  CHECK (channel = ANY (ARRAY[
    'whatsapp'::text,
    'instagram'::text,
    'email'::text,
    'sms'::text,
    'telefone'::text
  ]));

-- Expand message_type constraint
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type = ANY (ARRAY[
    'texto'::text,
    'audio'::text,
    'imagem'::text,
    'video'::text,
    'documento'::text,
    'chamada'::text,
    'comentario'::text,
    'story_reply'::text,
    'story_mention'::text,
    'reply_comentario'::text,
    'arquivo'::text
  ]));
