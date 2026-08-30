-- Rollback de 20260730190000_notif01_unread_conversations.sql
-- Aplicar DEPOIS de 20260730191000_notif02_notifications_table.rollback.sql.
-- Restaura o estado de 20260730182000_bump_clients_people_on_message.sql.

BEGIN;

DROP FUNCTION IF EXISTS public.mark_conversation_read(uuid);
DROP FUNCTION IF EXISTS public.recalc_unread_count(uuid);
DROP FUNCTION IF EXISTS public.person_conversation_accessible_to_current_user(uuid);

-- Corpo original do trigger (20260730182000).
CREATE OR REPLACE FUNCTION public.bump_clients_people_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.people_id IS NOT NULL THEN
    UPDATE public.clients_people SET updated_at = now() WHERE id = NEW.people_id;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

ALTER TABLE public.clients_people
  DROP COLUMN IF EXISTS unread_count,
  DROP COLUMN IF EXISTS first_unread_at,
  DROP COLUMN IF EXISTS last_read_at,
  DROP COLUMN IF EXISTS last_read_by;

ALTER TABLE public.messages DROP COLUMN IF EXISTS seen_at;

COMMIT;
