-- Rollback de 20260730201000_mark_read_recompute_unread_count.sql
-- Restaura o corpo de 20260730200000 (unread_count por decremento).
-- Só faz sentido se o recompute causar problema de performance em conversa muito longa;
-- o decremento tem o defeito conhecido de nunca convergir se o cache já estiver divergido.

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

  UPDATE public.clients_people cp
     SET unread_count    = GREATEST(cp.unread_count - v_marked, 0),
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
    UPDATE public.notifications
       SET read_at = now(),
           read_by = v_user_id
     WHERE people_id = p_people_id
       AND read_at IS NULL
       AND (message_id IS NULL OR message_id <= v_max_id);

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

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

COMMIT;
