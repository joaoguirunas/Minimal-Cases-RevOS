-- Rollback de 20260730200000_notif_rls_and_race_hardening.sql
-- Restaura o estado de 20260730191000 (com os bugs A, B e E de volta — só usar se o
-- hardening quebrar algo em produção, e reaplicar corrigido em seguida).

BEGIN;

-- A: predicado volta a liberar people_id NULL; policies voltam sem o guard.
CREATE OR REPLACE FUNCTION public.person_conversation_accessible_to_current_user(p_people_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_people_id IS NULL THEN
    RETURN true;
  END IF;

  IF public.is_admin_or_manager() THEN
    RETURN true;
  END IF;

  v_user_id := public.get_current_settings_user_id();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN
    EXISTS (SELECT 1 FROM public.clients_people cp
             WHERE cp.id = p_people_id AND cp.created_by = v_user_id)
    OR EXISTS (SELECT 1 FROM public.leads l
                WHERE l.people_id = p_people_id AND l.user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.leads l
                 JOIN public.settings_users_teams sut ON sut.team_id = l.teams_id
                WHERE l.people_id = p_people_id AND sut.user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.leads l
                WHERE l.people_id = p_people_id
                  AND public.lead_pipeline_accessible_to_current_user(l.leads_pipelines_id));
END;
$function$;

DROP POLICY notifications_read      ON public.notifications;
DROP POLICY notifications_mark_read ON public.notifications;

CREATE POLICY notifications_read ON public.notifications FOR SELECT
USING (public.person_conversation_accessible_to_current_user(people_id));

CREATE POLICY notifications_mark_read ON public.notifications FOR UPDATE
USING      (public.person_conversation_accessible_to_current_user(people_id))
WITH CHECK (public.person_conversation_accessible_to_current_user(people_id));

-- E: índice volta a ser não-único; trigger volta ao UPDATE/IF NOT FOUND/INSERT.
DROP INDEX public.idx_notifications_open;
CREATE INDEX idx_notifications_open ON public.notifications (people_id) WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION public.bump_clients_people_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  IF NEW.people_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.from_contact = 'cliente' THEN
    SELECT name INTO v_name FROM public.clients_people WHERE id = NEW.people_id;

    UPDATE public.notifications
       SET message_id      = NEW.id,
           body            = left(COALESCE(NEW.content, ''), 280),
           channel         = NEW.channel,
           unread_messages = unread_messages + 1,
           created_at      = now(),
           lead_id         = COALESCE(NEW.lead_id, lead_id)
     WHERE people_id = NEW.people_id
       AND event_type = 'inbound_message'
       AND read_at IS NULL;

    IF NOT FOUND THEN
      INSERT INTO public.notifications
        (event_type, people_id, lead_id, message_id, title, body, channel, unread_messages)
      VALUES
        ('inbound_message', NEW.people_id, NEW.lead_id, NEW.id,
         left(COALESCE(v_name, 'Contato sem nome'), 120),
         left(COALESCE(NEW.content, ''), 280),
         NEW.channel, 1);
    END IF;

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

-- B: volta a zerar o contador e a fechar a notificação sem escopo.
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

  UPDATE public.notifications
     SET read_at = now(),
         read_by = v_user_id
   WHERE people_id = p_people_id
     AND read_at IS NULL;

  RETURN v_marked;
END;
$function$;

COMMIT;
