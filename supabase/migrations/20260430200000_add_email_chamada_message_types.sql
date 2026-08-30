-- Adiciona 'email' e 'chamada' ao check constraint de message_type.
-- Contexto: NegocioConversa.tsx e Conversas.tsx inserem mensagens com
-- message_type='email' (canal email) e message_type='chamada' (registro de ligação),
-- mas esses valores estavam ausentes da constraint, causando violação em runtime.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_check
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
    'arquivo'::text,
    'private_reply'::text,
    'email'::text
  ]));
