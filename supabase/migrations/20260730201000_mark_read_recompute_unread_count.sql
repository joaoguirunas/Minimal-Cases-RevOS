-- Correção de 20260730200000 (já aplicada, portanto imutável).
--
-- O hardening trocou o "SET unread_count = 0" por um decremento
-- (GREATEST(unread_count - v_marked, 0)) enquanto first_unread_at passou a ser
-- recomputado por subquery. Duas estratégias diferentes na MESMA instrução:
--
--   1. O decremento nunca converge. Se unread_count já estiver divergido — que é
--      exatamente o cenário para o qual recalc_unread_count() existe — cada leitura
--      subtrai em cima do valor errado e o badge fica preso. E recalc_unread_count()
--      não tem GRANT para authenticated, então o usuário não tem como se recuperar.
--   2. Os dois campos podem discordar entre si: unread_count > 0 com first_unread_at
--      NULL (badge sem o "esperando há Xh") ou o inverso.
--
-- Recomputar os dois com o mesmo predicado e no mesmo snapshot elimina as duas coisas
-- e é auto-curativo: qualquer divergência se conserta na próxima abertura da conversa.
-- Custo idêntico — mesma tabela, mesmo predicado, mesmo índice parcial
-- (idx_messages_unread_by_person), e a subquery de first_unread_at já estava lá.

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_people_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := public.get_current_settings_user_id();
  v_marked  integer;
  v_max_id  bigint;
BEGIN
  IF p_people_id IS NULL OR v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- SECURITY DEFINER fura RLS: revalidar acesso na unha.
  IF NOT public.person_conversation_accessible_to_current_user(p_people_id) THEN
    RAISE EXCEPTION 'sem acesso a esta conversa';
  END IF;

  WITH marked AS (
    UPDATE public.messages
       SET seen_at = now()
     WHERE people_id = p_people_id
       AND from_contact = 'cliente'
       AND seen_at IS NULL
    RETURNING id
  )
  SELECT count(*), max(id) INTO v_marked, v_max_id FROM marked;

  -- updated_at NÃO é bumpado: ler uma conversa não pode ressuscitá-la
  -- no topo do Omni, que ordena por updated_at DESC.
  UPDATE public.clients_people cp
     SET unread_count    = (
           SELECT count(*) FROM public.messages m
            WHERE m.people_id = p_people_id
              AND m.from_contact = 'cliente'
              AND m.seen_at IS NULL
         ),
         first_unread_at = (
           SELECT min(m.created_at) FROM public.messages m
            WHERE m.people_id = p_people_id
              AND m.from_contact = 'cliente'
              AND m.seen_at IS NULL
         ),
         last_read_at    = now(),
         last_read_by    = v_user_id
   WHERE cp.id = p_people_id;

  IF v_max_id IS NOT NULL THEN
    -- Escopo por message_id e não por timestamp: messages.id é bigserial e a ordem de
    -- commit não acompanha a do relógio, então um cutoff temporal deixaria janela.
    UPDATE public.notifications
       SET read_at = now(),
           read_by = v_user_id
     WHERE people_id = p_people_id
       AND read_at IS NULL
       AND (message_id IS NULL OR message_id <= v_max_id);

    -- A notificação de uma inbound que chegou no meio sobrevive ao fechamento acima,
    -- mas contando também as mensagens recém-lidas. O índice UNIQUE garante no máximo
    -- 1 notificação aberta por (pessoa, tipo), então todas as não vistas são dela.
    UPDATE public.notifications
       SET unread_messages = GREATEST((
             SELECT count(*) FROM public.messages m
              WHERE m.people_id = p_people_id
                AND m.from_contact = 'cliente'
                AND m.seen_at IS NULL
           ), 1)
     WHERE people_id = p_people_id
       AND read_at IS NULL;
  END IF;

  RETURN v_marked;
END;
$function$;

COMMENT ON FUNCTION public.mark_conversation_read IS
  'Único caminho de escrita da leitura de uma conversa. Todo estado derivado (unread_count, first_unread_at, notifications.unread_messages) é RECOMPUTADO de messages, nunca zerado nem decrementado: zerar perde a inbound que chega no meio da transação, decrementar nunca converge se o cache já estiver divergido. Fechamento da notificação escopado por message_id.';

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

COMMIT;
