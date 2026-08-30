-- =============================================================================
-- FWUP-34: Repair messages_message_type_check — restore 'private_reply' + 'email'
-- =============================================================================
-- Root cause:
--   Migrations 20260430190000 (private_reply) and 20260430200000 (private_reply +
--   email) are recorded in supabase_migrations.schema_migrations as applied, but
--   the LIVE constraint contains neither value (drift from the "db push broken"
--   workflow — version stamped without the ALTER TABLE actually executing).
--
-- Symptoms (both Instagram + email manual send):
--   • Private reply to a commenter (Conversas.tsx -> tipo_mensagem='private_reply')
--     fails with: new row for relation "messages" violates check constraint
--     "messages_message_type_check". omni-delivery-engine routes 'private_reply'
--     to instagram-comment-reply (/private_replies — comment_id bypass, no IGSID
--     and no 7-day window needed), so the row MUST be insertable.
--   • Email send (tipo_mensagem='email') fails the same way.
--
-- Fix:
--   Re-assert the canonical constraint from 20260430200000 (strict superset of the
--   live 11 values). Idempotent: DROP IF EXISTS + ADD. Only widens the allowed set,
--   so no existing row can violate it.
-- =============================================================================

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

DO $$
BEGIN
  RAISE NOTICE 'FWUP-34: messages_message_type_check repaired — private_reply + email restored';
END $$;
