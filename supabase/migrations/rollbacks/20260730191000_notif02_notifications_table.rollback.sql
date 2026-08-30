-- Rollback de 20260730191000_notif02_notifications_table.sql
-- Deixa o banco no estado de 20260730190000 (NOTIF-01 aplicada, sino ausente).
--
-- NOTA: o valor 'inbound_message' do enum notification_event_type NÃO é removido —
-- PostgreSQL não suporta DROP VALUE. Fica órfão e inofensivo.

BEGIN;

ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;

DROP TABLE public.notifications;

-- Trigger volta ao corpo da NOTIF-01 (contador, sem sino).
CREATE OR REPLACE FUNCTION public.bump_clients_people_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.people_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.from_contact = 'cliente' THEN
    UPDATE public.clients_people
       SET updated_at      = now(),
           unread_count    = unread_count + 1,
           first_unread_at = COALESCE(first_unread_at, NEW.created_at, now())
     WHERE id = NEW.people_id;
  ELSE
    UPDATE public.clients_people SET updated_at = now() WHERE id = NEW.people_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

-- mark_conversation_read volta ao corpo da NOTIF-01 (sem fechar notificação).
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_people_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := public.get_current_settings_user_id();
  v_marked  integer;
BEGIN
  IF p_people_id IS NULL OR v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT public.person_conversation_accessible_to_current_user(p_people_id) THEN
    RAISE EXCEPTION 'sem acesso a esta conversa';
  END IF;

  UPDATE public.messages
     SET seen_at = now()
   WHERE people_id = p_people_id
     AND from_contact = 'cliente'
     AND seen_at IS NULL;
  GET DIAGNOSTICS v_marked = ROW_COUNT;

  UPDATE public.clients_people
     SET unread_count    = 0,
         first_unread_at = NULL,
         last_read_at    = now(),
         last_read_by    = v_user_id
   WHERE id = p_people_id;

  RETURN v_marked;
END;
$function$;

COMMIT;
