-- "Marcar todas" no sino vira ação LEVE: limpa só o feed de notificações.
--
-- Antes, o FE fazia um loop de mark_conversation_read() por people_id, o que cascateava
-- em messages.seen_at e clients_people.unread_count. Um clique em massa não significa que
-- o atendente leu cada conversa — e como o inbox é COMPARTILHADO, isso apagava o sinal de
-- "ninguém respondeu ainda" do time inteiro, sem undo. Clique numa notificação individual
-- continua chamando mark_conversation_read (aí sim o usuário abriu aquela conversa).

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := public.get_current_settings_user_id();
  v_marked  integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- SECURITY DEFINER fura RLS: repetir o predicado de visibilidade na unha, senão
  -- o usuário limparia notificação de conversa que nem pode enxergar.
  UPDATE public.notifications
     SET read_at = now(),
         read_by = v_user_id
   WHERE read_at IS NULL
     AND people_id IS NOT NULL
     AND public.person_conversation_accessible_to_current_user(people_id);

  GET DIAGNOSTICS v_marked = ROW_COUNT;
  RETURN v_marked;
END;
$function$;

COMMENT ON FUNCTION public.mark_all_notifications_read IS
  'Fecha o feed do sino em uma transação, respeitando a mesma visibilidade da policy de SELECT. Deliberadamente NÃO toca em messages.seen_at nem clients_people.unread_count: marcar o sino em massa não é o mesmo que ter atendido as conversas, e o inbox é compartilhado. Para o caso "abri esta conversa", use mark_conversation_read().';

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- Toda escrita real passa por RPC SECURITY DEFINER (mark_conversation_read no clique
-- individual, mark_all_notifications_read no "marcar todas"). A policy de UPDATE direto
-- virou superfície sem uso — e permitia ao client reescrever title/body/unread_messages
-- de qualquer notificação que ele enxergue. Sem consumidor no FE, é só risco.
DROP POLICY notifications_mark_read ON public.notifications;

COMMIT;
