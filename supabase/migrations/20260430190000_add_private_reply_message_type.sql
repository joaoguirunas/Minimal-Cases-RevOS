-- Adiciona 'private_reply' ao check constraint de message_type.
-- Contexto: Instagram "private reply" é uma resposta privada (DM) a um comentário,
-- roteada via /{comment_id}/private_replies na Graph API. Tipo distinto de 'reply_comentario'
-- (que é resposta pública) e de 'texto' (DM direto por IGSID).
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
    'private_reply'::text
  ]));
